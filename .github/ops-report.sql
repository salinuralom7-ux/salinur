-- What is costing MySheher money this week.
--
-- This file is read by .github/workflows/ops-report.yml and sent to Supabase
-- as a single query. It is the ONLY thing that runs against the live
-- database on a schedule, and it is deliberately one statement with no
-- writes in it: no insert, no update, no delete, no create, no grant. The
-- workflow refuses to send the file if any of those words appear in it, so
-- a change that made this thing able to touch data would fail in CI rather
-- than run at 6am on a Monday.
--
-- One result set comes back, shaped (section, item, detail, n, ord), and the
-- workflow turns it into .github/ops-report.md. To add a report, add a CTE
-- and another arm to the union — nothing else needs to change.

with

-- ---------- supply: trades nobody in Guwahati does ----------
-- service_rates is the list of trades the app offers, so a trade missing
-- from this count is a trade a customer can search for and find an empty
-- screen. Zero is an outage; one is a single point of failure — that person
-- goes to a wedding and the trade is dark for three days.
trade_cover as (
  select r.skill,
         count(*) filter (
           where w.status = 'approved' and w.available
         ) as n
    from service_rates r
    left join workers w
      on exists (select 1 from jsonb_array_elements(w.skills) s
                  where s->>'skill' = r.skill)
   group by r.skill
),

-- ---------- demand: what customers actually asked for ----------
-- Both routes into a booking, over the last 30 days: an instant job, and a
-- thread opened against a named worker. Area comes from the customer, so
-- this is where the demand IS, not where we happen to have people.
demand as (
  select skill, area, count(*) as n from (
    select j.skill, nullif(btrim(coalesce(j.area, '')), '') as area
      from jobs j
     where j.created_at > now() - interval '30 days'
    union all
    select t.skill, nullif(btrim(coalesce(t.customer_area, '')), '') as area
      from threads t
     where t.created_at > now() - interval '30 days'
  ) d
   where area is not null
   group by skill, area
),

-- Who could serve that demand: approved, available, lists the trade, and is
-- in the locality the customer named.
area_cover as (
  select d.skill, d.area, d.n as asked,
         (select count(*) from workers w
           where w.status = 'approved' and w.available
             and btrim(coalesce(w.area, '')) = d.area
             and exists (select 1 from jsonb_array_elements(w.skills) s
                          where s->>'skill' = d.skill)) as have
    from demand d
),

-- ---------- demand: requests nobody answered ----------
-- A thread sits at 'requested' until the worker accepts or declines. One
-- still sitting there after six hours is a customer who has been ignored,
-- and every hour after that is a customer who has phoned somebody else.
-- Nothing that identifies a person is selected here, or anywhere below.
-- The report this becomes is committed to a public repository, so a column
-- that is never read is still a column that must not be fetched.
waiting as (
  select t.skill,
         coalesce(nullif(btrim(t.customer_area), ''), 'area not given') as area,
         round(extract(epoch from (now() - t.created_at)) / 3600)::int as hours
    from threads t
   where t.status = 'requested'
     and t.created_at < now() - interval '6 hours'
     and t.created_at > now() - interval '30 days'
     and not exists (select 1 from messages m
                      where m.thread_id = t.id and m.sender = 'worker')
),

-- An instant job that ended 'nobody' is the same failure with a clock on
-- it: we asked everyone we had and nobody said yes. Jobs still 'searching'
-- past their own deadline are stuck in the same place.
nobody as (
  select j.skill,
         coalesce(nullif(btrim(j.area), ''), 'area not given') as area,
         j.asked_count
    from jobs j
   where j.created_at > now() - interval '7 days'
     and (j.status = 'nobody'
          or (j.status = 'searching' and j.search_until < now() - interval '1 hour'))
),

-- ---------- what the clock closed, and who let it ----------
-- nudge_threads() chases an unanswered request and closes it after a day.
-- That stops the customer being stranded, but it does not fix anything: a
-- request the clock had to close is still a booking that was won and lost.
-- This is the number that says whether the automation is papering over a
-- worker who should not be taking requests at all.
timed_out as (
  select t.skill,
         coalesce(nullif(btrim(t.customer_area), ''), 'area not given') as area,
         count(*) as n
    from threads t
   where t.timed_out
     and t.closed_at > now() - interval '30 days'
   group by 1, 2
),

-- ---------- supply: registrations that never finished ----------
-- Somebody filled the form, we never looked at it. Two days is generous.
stuck as (
  select round(extract(epoch from (now() - w.created_at)) / 86400)::int as days
    from workers w
   where coalesce(w.status, 'pending') = 'pending'
     and w.created_at < now() - interval '2 days'
),

-- Approved, and still invisible to customers: they turned themselves off,
-- or they never listed a trade, so the profile is a dead end.
dark as (
  select case when not w.available then 'switched themselves off'
              when jsonb_array_length(coalesce(w.skills, '[]'::jsonb)) = 0 then 'no trade listed'
              else 'unknown' end as why
    from workers w
   where w.status = 'approved'
     and (not w.available
          or jsonb_array_length(coalesce(w.skills, '[]'::jsonb)) = 0)
),

-- ---------- supply, ranked by what it is actually costing ----------
-- A weekly list of every uncovered trade is four hundred rows long on a
-- catalogue this size, and a report nobody reads is worse than no report.
-- What matters is the trade somebody asked for and we could not serve —
-- that one has a name and a phone number attached to it. Those come first
-- and all of them are shown. The rest is a recruiting backlog, not this
-- week's problem, so twelve of it is listed and the remainder is counted.
trade_demand as (
  select skill, count(*) as asked from (
    select skill from jobs    where created_at > now() - interval '60 days'
    union all
    select skill from threads where created_at > now() - interval '60 days'
  ) d group by skill
),
gap as (
  select c.skill, c.n, coalesce(d.asked, 0) as asked,
         row_number() over (order by c.n, c.skill) as rn
    from trade_cover c
    left join trade_demand d on d.skill = c.skill
   where c.n <= 1
),
gap_shown as (
  select * from gap where asked > 0
  union all
  select * from gap where asked = 0 and rn <= 12
),

-- ---------- the one-line summary at the top ----------
totals as (
  select
    (select count(*) from workers where status = 'approved')            as approved,
    (select count(*) from workers where status = 'approved' and available
       and jsonb_array_length(coalesce(skills, '[]'::jsonb)) > 0)       as live,
    (select count(*) from jobs    where created_at > now() - interval '7 days') as jobs7,
    (select count(*) from threads where created_at > now() - interval '7 days') as threads7,
    (select count(*) from threads
      where done_at is not null and done_at > now() - interval '7 days') as done7,
    (select count(*) from trade_cover where n = 0)                       as empty_trades,
    (select count(*) from waiting)                                       as waiting_n
)

select section, item, detail, n, ord from (

  select 'summary' as section,
         'This week' as item,
         t.live || ' workers live of ' || t.approved || ' approved · '
           || t.jobs7 || ' instant jobs and ' || t.threads7 || ' requests in 7 days · '
           || t.done7 || ' finished · '
           || t.empty_trades || ' trades with nobody · '
           || t.waiting_n || ' requests unanswered' as detail,
         null::int as n, 0 as ord, 0::numeric as k
    from totals t

  -- Grouped by trade and locality, not listed one by one. A row here says
  -- "two people in Beltola wanted an electrician yesterday and got silence",
  -- which is enough to know who to ring; the names are in the admin screen,
  -- where they belong.
  union all
  select 'Requests with no reply', skill || ' in ' || area,
         count(*) || ' request(s) with no reply · longest waiting '
           || max(hours) || ' hours',
         count(*)::int, 1, -max(hours)::numeric
    from waiting
   group by skill, area

  union all
  select 'Instant jobs nobody took', skill || ' in ' || area,
         count(*) || ' instant job(s) in 7 days nobody took · '
           || 'we had ' || max(asked_count) || ' worker(s) to ask at most',
         count(*)::int, 2, -count(*)::numeric
    from nobody
   group by skill, area

  union all
  -- Demand first, then the emptiest. n is the head count, so it sorts up.
  select 'Trades with nobody', skill,
         case when n = 0 then 'nobody at all' else 'one person only' end
           || case when asked > 0
                   then ', asked for ' || asked || ' time(s) in 60 days'
                   else case when n = 0
                             then ', so this search returns an empty screen'
                             else ', so if they are busy the trade is dark' end end,
         n, 3, (-asked * 1000 + n)::numeric
    from gap_shown

  union all
  select 'Trades with nobody', 'and ' || count(*) || ' more',
         'uncovered trades nobody has asked for yet: a recruiting backlog, '
           || 'not this week''s problem',
         count(*)::int, 3, 1e9
    from gap where asked = 0 and rn > 12
   having count(*) > 0

  union all
  select 'Closed because nobody replied', skill || ' in ' || area,
         n || ' request(s) in 30 days the clock had to close · '
           || 'the customer was told and offered somebody else',
         n::int, 2, -n::numeric
    from timed_out

  union all
  select 'Localities with nobody', skill || ' in ' || area,
         'asked for ' || asked || ' time(s) in 30 days, '
           || case when have = 0 then 'nobody there'
                   else have || ' person there' end,
         asked, 4, -asked::numeric
    from area_cover
   where have <= 1

  -- Counted, never named. This file is committed to a public repository, so
  -- a queue of people who have not been approved yet cannot be listed in it:
  -- they applied to us privately. The number is what tells you to go and
  -- open the review screen, and the review screen has the names.
  union all
  select 'Registrations waiting for review', 'the review queue',
         count(*) || ' registration(s) older than 2 days · oldest '
           || max(days) || ' days' || case when count(*) filter (where days > 7) > 0
                then ' · ' || count(*) filter (where days > 7) || ' over a week'
                else '' end,
         count(*)::int, 5, 0::numeric
    from stuck
   having count(*) > 0

  union all
  select 'Approved but invisible to customers', why,
         count(*) || ' approved worker(s) customers cannot see',
         count(*)::int, 6, -count(*)::numeric
    from dark
   group by why

) rows
order by ord, k, item;
