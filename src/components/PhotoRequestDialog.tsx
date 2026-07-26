import { useEffect, useRef, useState } from 'react';
import type { Listing } from '../types';
import { STORE } from '../config';
import { CONDITIONS } from '../data/conditions';
import { formatStorage, listingTitle } from '../lib/inventory';
import { inr } from '../lib/format';
import { useStore } from '../store/context';

/**
 * Real photographs are taken per unit, on request, rather than published up
 * front. Two reasons: every handset is physically different, so one gallery
 * cannot honestly represent the shelf; and photographing 1,900 listings that
 * turn over weekly is not something the shop can sustain.
 *
 * The request is handed to WhatsApp with the unit reference already filled in,
 * so the shop knows exactly which phone to photograph.
 */

function whatsappLink(listing: Listing, name: string, note: string): string {
  const lines = [
    `Hello ${STORE.name}, I would like to see real photos of this phone before buying.`,
    '',
    `Phone: ${listing.brand} ${listing.model}`,
    `Storage: ${formatStorage(listing.storageGb)}`,
    `Colour: ${listing.color.name}`,
    `Condition: ${CONDITIONS[listing.condition].name}`,
    `Price: ${inr(listing.price)}`,
    `Unit reference: ${listing.unitRef}`,
    '',
    `My name: ${name || '(not given)'}`,
  ];
  if (note.trim()) lines.push(`Note: ${note.trim()}`);

  return `https://wa.me/${STORE.whatsapp}?text=${encodeURIComponent(lines.join('\n'))}`;
}

function mailtoLink(listing: Listing, name: string, phone: string, note: string): string {
  const subject = `Photo request — ${listing.unitRef} (${listing.model})`;
  const body = [
    `I would like to see real photos of unit ${listing.unitRef} before buying.`,
    '',
    `Phone: ${listing.brand} ${listing.model}`,
    `Storage: ${formatStorage(listing.storageGb)}`,
    `Colour: ${listing.color.name}`,
    `Condition: ${CONDITIONS[listing.condition].name}`,
    '',
    `Name: ${name}`,
    `WhatsApp / phone: ${phone}`,
    note.trim() ? `Note: ${note.trim()}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return `mailto:${STORE.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export default function PhotoRequestDialog({
  listing,
  open,
  onClose,
}: {
  listing: Listing;
  open: boolean;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { addPhotoRequest } = useStore();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Reopening the dialog, or switching to a different handset, starts a fresh
  // request. Adjusted during render rather than in an effect.
  const session = `${open}:${listing.id}`;
  const [lastSession, setLastSession] = useState(session);
  if (session !== lastSession) {
    setLastSession(session);
    if (open) setSent(false);
  }

  const phoneValid = /^[6-9]\d{9}$/.test(phone.replace(/\D/g, ''));

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!phoneValid || name.trim().length < 2) return;

    addPhotoRequest({
      id: `${listing.id}:${Date.now()}`,
      listingId: listing.id,
      title: listingTitle(listing),
      unitRef: listing.unitRef,
      name: name.trim(),
      phone: phone.replace(/\D/g, ''),
      note: note.trim() || undefined,
      at: new Date().toISOString(),
    });

    setSent(true);
    window.open(whatsappLink(listing, name.trim(), note), '_blank', 'noopener');
  };

  return (
    <dialog ref={dialogRef} className="dialog" onClose={onClose} onCancel={onClose}>
      <div className="dialog-head">
        <h2>See the real photos</h2>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>

      {sent ? (
        <div className="dialog-body">
          <p className="lede">Request noted for unit {listing.unitRef}.</p>
          <p>
            We photograph the actual handset — front, back, all four edges, the screen switched on, and a
            close-up of every mark named in the listing — and send them to your WhatsApp. This usually takes
            under two hours during shop hours ({STORE.hours}).
          </p>
          <p className="muted">
            If the WhatsApp window did not open,{' '}
            <a href={whatsappLink(listing, name, note)} target="_blank" rel="noopener noreferrer">
              tap here
            </a>{' '}
            or email{' '}
            <a href={mailtoLink(listing, name, phone, note)}>{STORE.email}</a>.
          </p>
          <button type="button" className="btn btn-primary btn-block" onClick={onClose}>
            Done
          </button>
        </div>
      ) : (
        <form className="dialog-body" onSubmit={submit}>
          <div className="request-summary">
            <strong>{listingTitle(listing)}</strong>
            <span>
              {CONDITIONS[listing.condition].name} · {inr(listing.price)} · unit {listing.unitRef}
            </span>
          </div>

          <p>
            We do not publish stock photos, because every handset here is a different physical phone. Tell us
            where to send them and we will photograph this exact unit for you.
          </p>

          <label className="field">
            <span>Your name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={2}
              autoComplete="name"
            />
          </label>

          <label className="field">
            <span>WhatsApp number</span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="10-digit mobile number"
              inputMode="numeric"
              autoComplete="tel-national"
              required
            />
            {phone.length > 0 && !phoneValid && (
              <small className="field-error">Enter a valid 10-digit Indian mobile number.</small>
            )}
          </label>

          <label className="field">
            <span>
              Anything specific? <em>(optional)</em>
            </span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="e.g. close-up of the back glass, or a video of the screen"
            />
          </label>

          <button type="submit" className="btn btn-primary btn-block" disabled={!phoneValid || name.trim().length < 2}>
            Request photos on WhatsApp
          </button>
          <p className="muted small">
            Your number is used for this request only. Nothing is charged, and there is no obligation to buy.
          </p>
        </form>
      )}
    </dialog>
  );
}
