/**
 * features/store/Profile.tsx -- SC-17 Store profile (ADU-CON-03 v1.2 S11).
 *
 * PATCH /v1/seller/profile { store_name?, description?, category_id? } and
 * PATCH /v1/seller/company-details. Both coalesce updates: a field can be set
 * and never cleared.
 *
 * THE READ-BACK ABSENCE DOMINATES THIS SCREEN (register D-224). There is no
 * GET for a seller's own profile anywhere in the API: readiness returns
 * satisfied-flags, bootstrap returns market facts, and the public storefront
 * GET is 404 for a DRAFT seller and carries no category. So this form CANNOT
 * show current values -- it says so on screen, in words, instead of
 * pretending blank fields mean an empty profile. The live preview renders
 * WHAT IS TYPED, which is all this client can truthfully preview.
 *
 * No handle field: the PATCH does not carry one (G1.9 -- the handle is fixed
 * at creation), and the screen says so where a rename control would sit.
 * No logo field: no endpoint and no column exist; named on screen, D-224.
 *
 * The company block sits behind a disclosure because the seller's own TYPE
 * cannot be read back either; a sole trader who opens it and submits gets
 * the server's 409 SELLER_NOT_COMPANY, rendered, not swallowed. The
 * attestation sentence (R26): identity verification for a company is about
 * the REPRESENTATIVE AS A NATURAL PERSON.
 */
import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { en } from '@adulis/locale';
import { api, ApiError } from '../../api/client';
import { ProblemBanner } from '../../components/Feedback';
import type { CategoryRow } from './types';

export function Profile() {
  const { sellerId } = useParams<{ sellerId: string }>();
  const [categories, setCategories] = useState<readonly CategoryRow[]>([]);
  const [categoriesFailed, setCategoriesFailed] = useState(false);
  const [storeName, setStoreName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [companyOpen, setCompanyOpen] = useState(false);
  const [regId, setRegId] = useState('');
  const [licence, setLicence] = useState('');
  const [tin, setTin] = useState('');
  const [repPersonId, setRepPersonId] = useState('');
  const [repRelationship, setRepRelationship] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<ApiError | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // Public endpoint; categories are market-shared vocabulary.
    api<{ data: CategoryRow[] }>(`/categories`)
      .then((r) => setCategories(r.data))
      .catch(() => {
        // Failure is not the same fact as an empty vocabulary; say which.
        setCategories([]);
        setCategoriesFailed(true);
      });
  }, []);

  const saveProfile = async () => {
    if (!sellerId) return;
    setFieldError(null);
    setSaved(false);
    // The PATCH refuses an empty patch with a 400; refusing here says why.
    if (!storeName.trim() && !description.trim() && !categoryId) {
      setFieldError(en['console.store.profile.nothing_to_save']);
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      await api(`/seller/profile`, {
        method: 'PATCH',
        sellerId,
        body: {
          ...(storeName.trim() ? { store_name: storeName.trim() } : {}),
          ...(description.trim() ? { description: description.trim() } : {}),
          ...(categoryId ? { category_id: categoryId } : {}),
        },
      });
      setSaved(true);
    } catch (e) {
      if (e instanceof ApiError) setProblem(e);
    } finally {
      setBusy(false);
    }
  };

  const saveCompany = async () => {
    if (!sellerId) return;
    setFieldError(null);
    setSaved(false);
    if (!regId.trim() || !licence.trim() || !tin.trim() || !repPersonId.trim() || !repRelationship.trim()) {
      setFieldError(en['console.store.profile.company_all_required']);
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      await api(`/seller/company-details`, {
        method: 'PATCH',
        sellerId,
        body: {
          registration_identifier: regId.trim(),
          trade_licence_number: licence.trim(),
          tin: tin.trim(),
          representative_person_id: repPersonId.trim(),
          representative_relationship: repRelationship.trim(),
        },
      });
      setSaved(true);
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.problem.slots?.['reason'] === 'SELLER_NOT_COMPANY') {
          setFieldError(en['console.store.profile.not_company']);
        } else {
          setProblem(e);
        }
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="profile-heading" data-screen="SC-17" className="store-profile">
      <h1 id="profile-heading">{en['console.store.profile.heading']}</h1>

      {problem ? <ProblemBanner problem={problem.problem} /> : null}
      {fieldError ? (
        <p className="field-error" role="alert">
          {fieldError}
        </p>
      ) : null}
      {saved ? <p className="callout">{en['console.store.profile.saved']}</p> : null}

      {/* The read-back absence, named where the seller will wonder (D-224). */}
      <p className="hint">{en['console.store.profile.readback_owed']}</p>

      <div className="form-block">
        <label htmlFor="sp-name">{en['console.store.profile.store_name']}</label>
        <input id="sp-name" value={storeName} onChange={(e) => setStoreName(e.target.value)} />

        <label htmlFor="sp-desc">{en['console.store.profile.description']}</label>
        <textarea id="sp-desc" value={description} onChange={(e) => setDescription(e.target.value)} />

        <label htmlFor="sp-category">{en['console.store.profile.category']}</label>
        <select id="sp-category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">{en['console.store.profile.category_unchanged']}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code}
            </option>
          ))}
        </select>
        {categoriesFailed ? (
          <p className="field-error" role="alert">
            {en['console.store.profile.categories_failed']}
          </p>
        ) : categories.length === 0 ? (
          // No environment seeds core.category yet, and the wire carries only
          // machine codes, no display names (D-225) -- both said, not faked.
          <p className="hint">{en['console.store.profile.categories_none']}</p>
        ) : (
          <p className="hint">{en['console.store.profile.category_code_note']}</p>
        )}

        {/* G1.9: no rename control exists to lie with. */}
        <p className="hint">{en['console.store.profile.handle_immutable']}</p>
        {/* No endpoint, no column: named, never a dead file input (D-224). */}
        <p className="hint">{en['console.store.profile.logo_owed']}</p>

        <button type="button" className="button primary" disabled={busy} onClick={() => void saveProfile()}>
          {en['console.store.profile.save']}
        </button>
      </div>

      <section aria-labelledby="preview-heading" className="storefront-preview">
        <h2 id="preview-heading">{en['console.store.profile.preview_heading']}</h2>
        {/* Only what is TYPED can be previewed -- the saved values cannot be
            read back, and this caption says which of the two this is. */}
        <p className="hint">{en['console.store.profile.preview_caption']}</p>
        <div className="preview-card">
          <h3>{storeName.trim() || en['console.store.profile.preview_name_placeholder']}</h3>
          <p>{description.trim() || en['console.store.profile.preview_desc_placeholder']}</p>
        </div>
      </section>

      <section aria-labelledby="company-heading" className="company-details">
        <h2 id="company-heading">{en['console.store.profile.company_heading']}</h2>
        {/* R26: the attestation is about the representative as a natural
            person -- stated BEFORE the fields, because it surprises people. */}
        <p>{en['console.store.profile.company_representative_note']}</p>
        <button
          type="button"
          className="button"
          aria-expanded={companyOpen}
          onClick={() => setCompanyOpen((o) => !o)}
        >
          {en['console.store.profile.company_toggle']}
        </button>
        {companyOpen ? (
          <div className="form-block">
            <p className="hint">{en['console.store.profile.company_type_note']}</p>
            <label htmlFor="sp-reg">{en['console.store.profile.company_registration']}</label>
            <input id="sp-reg" value={regId} onChange={(e) => setRegId(e.target.value)} />
            <label htmlFor="sp-licence">{en['console.store.profile.company_licence']}</label>
            <input id="sp-licence" value={licence} onChange={(e) => setLicence(e.target.value)} />
            <label htmlFor="sp-tin">{en['console.store.profile.company_tin']}</label>
            <input id="sp-tin" value={tin} onChange={(e) => setTin(e.target.value)} />
            <label htmlFor="sp-rep">{en['console.store.profile.company_representative']}</label>
            <input id="sp-rep" value={repPersonId} onChange={(e) => setRepPersonId(e.target.value)} />
            <label htmlFor="sp-rel">{en['console.store.profile.company_relationship']}</label>
            <input id="sp-rel" value={repRelationship} onChange={(e) => setRepRelationship(e.target.value)} />
            <button type="button" className="button" disabled={busy} onClick={() => void saveCompany()}>
              {en['console.store.profile.company_save']}
            </button>
          </div>
        ) : null}
      </section>
    </section>
  );
}
