import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import type { CategoryAttributes, ProductDetail } from '../../contracts/gap-sc-catalogue';
import { Icon } from '../../components/Icon';
import { PageTitle } from '../../components/PageTitle';
import { Skeleton } from '../../components/Skeleton';
import { StatePanel } from '../../components/StatePanel';
import { t } from '../../i18n/t';
import { sellerPath } from '../../seller/access';
import { useSeller } from '../../seller/context';
import { useSellerQuery } from '../../seller/useSellerQuery';
import { NotFoundInSeller } from '../unavailable/NotFound';
import { DirtyProvider, newer, UnsavedNote } from '../shared/dirty';
import { AttributesSection } from './AttributesSection';
import { AvailabilitySection } from './AvailabilitySection';
import { AvailabilityBadge, StateBadge } from './badges';
import { IdentitySection } from './IdentitySection';
import { InventorySection } from './InventorySection';
import { MediaSection } from './MediaSection';
import { PublicationSection } from './PublicationSection';
import { TikTokSection } from './TikTokSection';
import { SectionNav } from '../shared/SectionNav';
import { VariantsSection } from './VariantsSection';

function Failed({ title, retry }: { title: string; retry: () => void }) {
  return (
    <StatePanel
      kind="danger"
      alert
      title={title}
      actions={
        <button type="button" className="btn btn-primary" onClick={retry}>
          {t('state.retry')}
        </button>
      }
    >
      <p>{t('state.transport_error_body')}</p>
    </StatePanel>
  );
}

/** Loads the attribute definitions of the SAVED category. No category yet is a normal state, not an error: the generic editor still works. */
function WithAttributes({ categoryId, children }: { categoryId: string | null; children: (attributes: CategoryAttributes | null) => ReactNode }) {
  return categoryId === null ? <>{children(null)}</> : <Loaded categoryId={categoryId}>{children}</Loaded>;
}
function Loaded({ categoryId, children }: { categoryId: string; children: (attributes: CategoryAttributes | null) => ReactNode }) {
  const { state, retry } = useSellerQuery('catalogue.category.attributes.get', { category_id: categoryId });
  if (state.status === 'error') return <Failed title={t('editor.attributes_error')} retry={retry} />;
  // While another category's definitions are still on screen (a category change), they are not this category's: wait.
  if (state.status === 'loading' || state.data.category_id !== categoryId) return <Skeleton rows={4} />;
  return <>{children(state.data)}</>;
}

function Editor({ productId }: { productId: string }) {
  const product = useSellerQuery('products.get', { product_id: productId });
  const tree = useSellerQuery('catalogue.categories.get', {});
  const market = useSellerQuery('market.context.get', {});
  const { sellerId } = useSeller();
  const [detail, setDetail] = useState<ProductDetail | null>(null);
  // Forms re-initialise only when the Seller asked for a reload (a stale version); a quiet refresh never wipes typing.
  const [epoch, setEpoch] = useState(0);
  const reloading = useRef(false);
  const retryProduct = product.retry;

  useEffect(() => {
    if (product.state.status !== 'ready' || product.state.refreshing) return;
    const incoming = product.state.data;
    setDetail((prev) => newer(prev, incoming));
    if (reloading.current) {
      reloading.current = false;
      setEpoch((n) => n + 1);
    }
  }, [product.state]);

  const onReload = useCallback(() => {
    reloading.current = true;
    retryProduct();
  }, [retryProduct]);
  const onRefresh = useCallback(() => retryProduct(), [retryProduct]);

  if (product.state.status === 'error') {
    // A Product of another Seller and a Product that does not exist are the same answer: existence is never disclosed.
    const notFound = product.state.error.code === 'NOT_FOUND' || product.state.error.code === 'PERMISSION_DENIED';
    return notFound ? <NotFoundInSeller /> : <Failed title={t('editor.error_title')} retry={product.retry} />;
  }
  if (tree.state.status === 'error') return <Failed title={t('editor.categories_error')} retry={tree.retry} />;
  if (!detail || tree.state.status !== 'ready') return <Skeleton rows={6} />;

  const timezone = market.state.status === 'ready' ? market.state.data.timezone : undefined;
  const adopt = (next: ProductDetail) => setDetail((prev) => newer(prev, next));
  const shared = { detail, onChange: adopt, onReload, onRefresh, timezone };
  const heading = detail.title.trim() === '' ? t('editor.new_title') : detail.title;
  return (
    <DirtyProvider>
      <PageTitle title={t('editor.page_title')}>{heading}</PageTitle>
      <UnsavedNote />
      <p>
        <Link className="btn btn-link" to={sellerPath(sellerId, 'products')}>
          <span className="flip" aria-hidden="true"><Icon name="arrow" /></span>
          <span>{t('editor.back')}</span>
        </Link>
      </p>
      <div className="badges">
        <StateBadge state={detail.publication.state} />
        {detail.variants.length > 0 ? <AvailabilityBadge availability={detail.availability} /> : null}
      </div>
      <SectionNav
        links={[
          { id: 'identity', label: t('onpage.details') },
          { id: 'attributes', label: t('onpage.attributes') },
          { id: 'variants', label: t('onpage.variants') },
          { id: 'inventory', label: t('onpage.stock') },
          { id: 'media', label: t('onpage.images') },
          { id: 'tiktok-section', label: t('onpage.tiktok') },
          { id: 'availability', label: t('onpage.display') },
          { id: 'publication', label: t('onpage.publication') },
        ]}
      />
      <IdentitySection key={`identity-${epoch}`} {...shared} categories={tree.state.data.categories} />
      <WithAttributes categoryId={detail.category_id}>
        {(attributes) => (
          <>
            <AttributesSection key={`attributes-${epoch}-${detail.category_id ?? ''}`} {...shared} attributes={attributes} />
            <VariantsSection key={`variants-${epoch}`} {...shared} attributes={attributes} />
          </>
        )}
      </WithAttributes>
      <InventorySection key={`inventory-${epoch}`} {...shared} />
      <MediaSection key={`media-${epoch}`} {...shared} />
      <TikTokSection key={`tiktok-${epoch}`} {...shared} />
      <AvailabilitySection key={`availability-${epoch}`} {...shared} />
      <PublicationSection key={`publication-${epoch}`} {...shared} />
    </DirtyProvider>
  );
}

/** The Product editor (CONSOLE-02 S49): identity and category, attributes, Variants and prices, inventory, media, buyer-facing stock display, publication. */
export function ProductEditor() {
  const { productId } = useParams<'productId'>();
  return productId ? <Editor key={productId} productId={productId} /> : <NotFoundInSeller />;
}
