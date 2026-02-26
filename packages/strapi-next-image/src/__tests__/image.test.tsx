import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import React, { createRef } from 'react';
import { Image } from '../image';

afterEach(cleanup);

describe('<Image /> component', () => {
  it('renders img with correct attributes', () => {
    render(
      <Image alt="test image" src="/photo.jpg" width={400} height={300} />
    );
    const img = screen.getByRole('img');
    expect(img).toBeDefined();
    expect(img.getAttribute('alt')).toBe('test image');
    expect(img.getAttribute('data-nimg')).toBe('1');
    expect(img.getAttribute('decoding')).toBe('async');
    expect(img.getAttribute('loading')).toBe('lazy');
    expect(img.getAttribute('src')).toContain('/api/image-optimize');
    expect(img.getAttribute('srcset')).toBeTruthy();
  });

  it('renders fill mode', () => {
    render(<Image alt="fill image" src="/photo.jpg" fill />);
    const img = screen.getByRole('img');
    expect(img.getAttribute('data-nimg')).toBe('fill');
    expect(img.style.position).toBe('absolute');
    expect(img.style.width).toBe('100%');
    expect(img.style.height).toBe('100%');
    expect(img.getAttribute('width')).toBeNull();
    expect(img.getAttribute('height')).toBeNull();
  });

  it('passes HTML attributes through', () => {
    render(
      <Image
        alt="test"
        src="/photo.jpg"
        width={100}
        height={100}
        data-testid="hero"
        id="hero-img"
        aria-label="Hero"
      />
    );
    const img = screen.getByTestId('hero');
    expect(img.id).toBe('hero-img');
    expect(img.getAttribute('aria-label')).toBe('Hero');
  });

  it('merges styles with color:transparent base', () => {
    render(
      <Image
        alt="test"
        src="/photo.jpg"
        width={100}
        height={100}
        style={{ maxWidth: '100%', height: 'auto' }}
      />
    );
    const img = screen.getByRole('img');
    expect(img.style.color).toBe('transparent');
    expect(img.style.maxWidth).toBe('100%');
    expect(img.style.height).toBe('auto');
  });

  it('forwards ref to img element', () => {
    const ref = createRef<HTMLImageElement>();
    render(
      <Image
        ref={ref}
        alt="test"
        src="/photo.jpg"
        width={100}
        height={100}
      />
    );
    expect(ref.current).toBeInstanceOf(HTMLImageElement);
  });

  it('renders StrapiMedia as src', () => {
    const media = {
      id: 1,
      url: '/uploads/photo.jpg',
      width: 800,
      height: 600,
      alternativeText: 'A photo',
    };
    render(<Image alt="" src={media} />);
    const img = screen.getByRole('img');
    expect(img.getAttribute('alt')).toBe('A photo');
    expect(img.getAttribute('width')).toBe('800');
    expect(img.getAttribute('height')).toBe('600');
    expect(img.getAttribute('src')).toContain(
      encodeURIComponent('/uploads/photo.jpg')
    );
  });

  it('appends preload link when priority=true', async () => {
    document.head
      .querySelectorAll('link[rel="preload"]')
      .forEach((l) => l.remove());

    render(
      <Image
        alt="test"
        src="/priority.jpg"
        width={100}
        height={100}
        priority
      />
    );

    await waitFor(() => {
      const link = document.head.querySelector('link[rel="preload"]');
      expect(link).not.toBeNull();
    });
  });

  it('does not append preload link by default', async () => {
    document.head
      .querySelectorAll('link[rel="preload"]')
      .forEach((l) => l.remove());

    render(
      <Image alt="test" src="/no-preload.jpg" width={100} height={100} />
    );

    // Give useEffect a chance to run, then verify no link was added
    await waitFor(() => {
      expect(screen.getByRole('img')).toBeDefined();
    });
    const link = document.head.querySelector('link[rel="preload"]');
    expect(link).toBeNull();
  });
});
