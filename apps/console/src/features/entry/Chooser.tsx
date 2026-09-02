/**
 * features/entry/Chooser.tsx -- "/", the seller chooser (redirect when
 * exactly one -- S2.1).
 *
 * THE CONTRACT HAS NO SELLERS-LIST ENDPOINT (register D-97): nothing
 * returns "the sellers this account holds", so the chooser cannot
 * enumerate. Until the contract grows one, this screen states the gap and
 * accepts a store id -- which also keeps the C-2 flow honest: the seed
 * prints the seller id it created, and /s/<id> is the URL shape every
 * seller-scoped screen keys on anyway.
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { en } from '@adulis/locale';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function Chooser() {
  const nav = useNavigate();
  const [id, setId] = useState('');
  const valid = UUID_RE.test(id);
  return (
    <main className="chooser">
      <h1>{en['console.chooser.title']}</h1>
      {/* The gap stays labelled (T9 S4.2's ruling), but the register number
          rides the DOM rather than the sentence: a seller in Addis should not
          have to read "D-97" to learn that we cannot list their stores. The
          attribute keeps it greppable, and chooser.spec.ts asserts BOTH -- the
          plain sentence and this attribute -- so the hole still cannot be
          quietly closed over. */}
      <p className="hint" data-gap="D-97">
        {en['console.chooser.gap']}
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) nav(`/s/${id}`);
        }}
      >
        <label htmlFor="chooser-id">{en['console.chooser.id_label']}</label>
        <input
          id="chooser-id"
          value={id}
          onChange={(e) => setId(e.target.value.trim())}
          aria-invalid={id.length > 0 && !valid ? true : undefined}
        />
        <button type="submit">{en['console.chooser.open_button']}</button>
      </form>
      {/* T17: a brand-new seller landed here with no store and no way to make
          one -- /s/new had to be TYPED, which is the point at which a real
          seller stops and messages us. The route already existed; nothing
          pointed at it. This does not need an endpoint, so it is fixed here;
          ENUMERATING the stores this account holds still does, and D-97's own
          ruling is that the endpoint's shape is contract design. */}
      <p className="create-store">
        {en['console.chooser.create_prompt']}{' '}
        <Link to="/s/new">{en['console.chooser.create_link']}</Link>
      </p>
      {/* The courier's way in (C-8): the session carries no roles for the
          client to gate on (the contract's roles[] rendering hint is the
          owed refinement, D-228) -- so the link is plain, and a non-courier
          who follows it meets the EMPTY state that explains itself. */}
      <p className="courier-link">
        <Link to="/courier">{en['console.courier.chooser_link']}</Link>
      </p>
    </main>
  );
}
