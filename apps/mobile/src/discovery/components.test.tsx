// Discovery presentation: the card's single primary action, honest list states, the unknown-unit backstop. Automated
// accessibility assertions only; native screen-reader evidence is a separate class.
import { fireEvent, render, screen } from '@testing-library/react-native';

import type { ProductTile, SceneCardUnit } from '../contracts/gap-mob-discovery';
import { TransportError } from '../transport/port';
import { PagedList, ProductTileView, SceneCard } from './components';

const money = { minor: 45000, currency: 'USD' };
const scene = (n: number, available = true): SceneCardUnit => ({
  type: 'SCENE_POST',
  sceneRef: `s${n}`,
  caption: `Caption ${n}`,
  seller: { sellerRef: 'sel1', storeName: 'Store One' },
  image: { ref: `m${n}`, aspect: 1.5, alt: `Photo ${n}` },
  tags: [{ position: 1, productRef: 'p1', name: 'Basket', available, hotspot: { x: 0.5, y: 0.5 }, priceMin: money, priceMax: money }],
});
const tile: ProductTile = { productRef: 'p1', seller: { sellerRef: 'sel1', storeName: 'Store One' }, name: 'Basket', priceMin: money, priceMax: money, available: false, image: null };

describe('SceneCard', () => {
  it('has exactly one Explore the Scene button, and the photo shortcut is not a second screen-reader stop', async () => {
    const onExplore = jest.fn();
    await render(<SceneCard scene={scene(1)} onExplore={onExplore} />);
    const buttons = screen.getAllByRole('button', { name: 'Explore the Scene' });
    expect(buttons).toHaveLength(1);
    await fireEvent.press(buttons[0] as (typeof buttons)[number]);
    expect(onExplore).toHaveBeenCalledTimes(1);
  });

  it('says a tag is unavailable in words, with no number, and draws no hotspot, Like count or comment control on the card', async () => {
    await render(<SceneCard scene={scene(2, false)} onExplore={() => undefined} />);
    expect(screen.getByText(/Basket\. Currently unavailable/)).toBeTruthy();
    expect(screen.queryByText(/\blike|comment|trending|popular|recommended|only \d+ left/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /open product/i })).toBeNull(); // hotspots belong to Scene Explorer
  });

  it('gives the photo an accessible description and shows the Seller', async () => {
    await render(<SceneCard scene={scene(3)} onExplore={() => undefined} />);
    expect(screen.getByRole('image', { name: 'Photo 3' })).toBeTruthy();
    expect(screen.getByText('By Store One')).toBeTruthy();
  });
});

describe('ProductTileView', () => {
  it('names price and availability for a screen reader and never shows a stock number or a discount', async () => {
    await render(<ProductTileView product={tile} onOpen={() => undefined} />);
    const button = screen.getByRole('button', { name: /Basket\..*Currently unavailable/ });
    expect(button).toBeTruthy();
    expect(screen.queryByText(/% off|was |only \d+/i)).toBeNull();
  });
});

type Q = React.ComponentProps<typeof PagedList<SceneCardUnit>>['query'];
const query = (over: Partial<Q>): Q => ({ data: undefined, status: 'success', error: null, isFetchingNextPage: false, hasNextPage: false, isRefetching: false, fetchNextPage: () => undefined, refetch: () => undefined, ...over });
const list = (q: Q, extra: { accept?: (s: SceneCardUnit) => boolean } = {}) => <PagedList<SceneCardUnit> query={q} keyOf={(s) => s.sceneRef} renderItem={(s) => <SceneCard scene={s} onExplore={() => undefined} />} {...extra} />;

describe('PagedList states', () => {
  it('shows loading, then the server order, with a repeat across pages shown once', async () => {
    await render(list(query({ status: 'pending' })));
    expect(screen.getByText('Loading.')).toBeTruthy();
    await render(list(query({ data: { pages: [{ items: [scene(1), scene(2)] }, { items: [scene(2), scene(3)] }] } })));
    expect(screen.getAllByText(/^Caption \d$/).map((n) => n.props.children)).toEqual(['Caption 1', 'Caption 2', 'Caption 3']);
  });

  it('skips a unit the client does not know (the backstop) and never shows it', async () => {
    const unknown = { ...scene(9), type: 'PRODUCT_POST' } as unknown as SceneCardUnit;
    await render(list(query({ data: { pages: [{ items: [scene(1), unknown] }] } }), { accept: (s) => s.type === 'SCENE_POST' }));
    expect(screen.queryByText('Caption 9')).toBeNull();
    expect(screen.getByText('Caption 1')).toBeTruthy();
  });

  it('is honest about empty, offline, gone and failure, each with a way forward', async () => {
    await render(list(query({ data: { pages: [{ items: [] }] } })));
    expect(screen.getByText('Nothing here yet.')).toBeTruthy();
    const refetch = jest.fn();
    await render(list(query({ status: 'error', error: new TransportError('NETWORK'), refetch })));
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(screen.getAllByText(/offline/i).length).toBeGreaterThan(0);
    await render(list(query({ status: 'error', error: new TransportError('NOT_FOUND') })));
    expect(screen.getAllByText('We could not find what you were looking for.').length).toBeGreaterThan(0);
    await render(list(query({ status: 'error', error: new TransportError('INTERNAL') })));
    expect(screen.getAllByText('Something went wrong on our side. Please try again.').length).toBeGreaterThan(0);
  });

  it('a failed refresh over items on screen keeps them and says offline at the foot, with Try again (archived list-refresh)', async () => {
    const refetch = jest.fn();
    await render(list(query({ status: 'error', error: new TransportError('NETWORK'), data: { pages: [{ items: [scene(1), scene(2)] }] }, refetch })));
    expect(screen.getByText('Caption 1')).toBeTruthy();
    expect(screen.getByText('Caption 2')).toBeTruthy();
    expect(screen.getAllByText(/offline/i).length).toBeGreaterThan(0);
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('offers Load more that always works, one request at a time', async () => {
    const fetchNextPage = jest.fn();
    await render(list(query({ data: { pages: [{ items: [scene(1)] }] }, hasNextPage: true, fetchNextPage })));
    await fireEvent.press(screen.getByRole('button', { name: 'Load more' }));
    expect(fetchNextPage).toHaveBeenCalledTimes(1);
  });
});
