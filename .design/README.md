# Redesign artboards

Working sources for the design canvas comparing two visual directions for
the app — light and dark — across Home, Browse and the worker profile.

    Main.dc.html          Home, light            (the canvas entry file)
    HomeDark.dc.html      Home, dark
    BrowseLight.dc.html   search results, light
    BrowseDark.dc.html    search results, dark
    ProfileLight.dc.html  worker profile, light
    ProfileDark.dc.html   worker profile, dark
    canvas.json           where each sits on the canvas, plus the notes
    mark.png              docs/icons/logo.png at 96px
    wordmark.png          docs/icons/wordmark.png at 64px

These are mockups, not the app. They borrow the shipped vocabulary exactly —
Plus Jakarta Sans, radii 10/14/20, #FFC300 with #171200 on top, 60px avatars —
so that what differs between them and `docs/index.html` is a deliberate
proposal rather than drift.

What both directions change:

* the 1px teal-tinted border on every surface is dropped; grouping is
  carried by elevation in light and by a neutral hairline in dark
* the worker card shows jobs done, punctuality and the tier badge, all of
  which `search_workers` has returned since Migration 45 and none of which
  the app draws
* results begin one row below the header rather than seven
* the stat wall and the numbered how-it-works strip are gone

Grey circles and squares are where real worker photographs go. They are
deliberately empty: no face is published without that person's written
permission.

Every text colour in both directions clears 4.5:1 against every ground it
can sit on. The separator dots do not and are not meant to — they are
punctuation, checked at 2.0:1 light and 2.7:1 dark so they read as a pause
rather than as a word.
