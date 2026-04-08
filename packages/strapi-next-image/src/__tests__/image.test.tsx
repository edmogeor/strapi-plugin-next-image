import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor, act } from '@testing-library/react';
import React, { createRef } from 'react';
import { Image } from '../image';

afterEach(cleanup);

describe('<Image /> component', () => {
  it('renders img with correct attributes', () => {
    render(<Image alt="test image" src="/photo.jpg" width={400} height={300} />);
    const img = screen.getByRole('img');
    expect(img).toBeDefined();
    expect(img.getAttribute('alt')).toBe('test image');
    expect(img.getAttribute('data-nimg')).toBe('1');
    expect(img.getAttribute('decoding')).toBe('async');
    expect(img.getAttribute('loading')).toBe('lazy');
    expect(img.getAttribute('src')).toContain('/api/next-image');
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
      />,
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
      />,
    );
    const img = screen.getByRole('img');
    expect(img.style.color).toBe('transparent');
    expect(img.style.maxWidth).toBe('100%');
    expect(img.style.height).toBe('auto');
  });

  it('forwards ref to img element', () => {
    const ref = createRef<HTMLImageElement>();
    render(<Image ref={ref} alt="test" src="/photo.jpg" width={100} height={100} />);
    expect(ref.current).toBeInstanceOf(HTMLImageElement);
  });

  it('renders fetchpriority="high" when fetchPriority="high" is passed', () => {
    render(<Image alt="test" src="/photo.jpg" width={100} height={100} fetchPriority="high" />);
    const img = screen.getByRole('img');
    expect(img.getAttribute('fetchpriority')).toBe('high');
  });

  it('does not render fetchpriority attribute when fetchPriority is not passed', () => {
    render(<Image alt="test" src="/photo.jpg" width={100} height={100} />);
    const img = screen.getByRole('img');
    // fetchpriority should be absent (not "auto") to avoid SSR/client mismatch
    expect(img.getAttribute('fetchpriority')).toBeNull();
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
    expect(img.getAttribute('src')).toContain(encodeURIComponent('/uploads/photo.jpg'));
  });

  it('appends preload link when priority=true', async () => {
    document.head.querySelectorAll('link[rel="preload"]').forEach((l) => l.remove());

    render(<Image alt="test" src="/priority.jpg" width={100} height={100} priority />);

    await waitFor(() => {
      const link = document.head.querySelector('link[rel="preload"]');
      expect(link).not.toBeNull();
    });
  });

  it('does not append preload link by default', async () => {
    document.head.querySelectorAll('link[rel="preload"]').forEach((l) => l.remove());

    render(<Image alt="test" src="/no-preload.jpg" width={100} height={100} />);

    // Give useEffect a chance to run, then verify no link was added
    await waitFor(() => {
      expect(screen.getByRole('img')).toBeDefined();
    });
    const link = document.head.querySelector('link[rel="preload"]');
    expect(link).toBeNull();
  });
});

describe('<Image /> — loading behaviour', () => {
  afterEach(cleanup);

  it('does not set loading attribute when priority=true', () => {
    render(<Image alt="test" src="/photo.jpg" width={400} height={300} priority />);
    const img = screen.getByRole('img');
    // priority images omit the loading attribute (no lazy loading)
    expect(img.getAttribute('loading')).toBeNull();
  });

  it('sets loading="eager" when loading prop is "eager"', () => {
    render(<Image alt="test" src="/photo.jpg" width={400} height={300} loading="eager" />);
    const img = screen.getByRole('img');
    expect(img.getAttribute('loading')).toBe('eager');
  });

  it('calls onLoad callback after image fires load event', async () => {
    const onLoad = vi.fn();
    render(<Image alt="test" src="/photo.jpg" width={200} height={150} onLoad={onLoad} />);
    const img = screen.getByRole('img');

    await act(async () => {
      img.dispatchEvent(new Event('load'));
    });

    await waitFor(() => expect(onLoad).toHaveBeenCalledOnce());
    expect(onLoad).toHaveBeenCalledWith(expect.objectContaining({ target: img }));
  });

  it('calls onLoadingComplete callback after image fires load event', async () => {
    const onLoadingComplete = vi.fn();
    render(
      <Image
        alt="test"
        src="/photo.jpg"
        width={200}
        height={150}
        onLoadingComplete={onLoadingComplete}
      />,
    );
    const img = screen.getByRole('img');

    await act(async () => {
      img.dispatchEvent(new Event('load'));
    });

    await waitFor(() => expect(onLoadingComplete).toHaveBeenCalledOnce());
    expect(onLoadingComplete).toHaveBeenCalledWith(img);
  });

  it('unoptimized image src is passed through without /api/next-image', () => {
    render(<Image alt="test" src="/static/photo.jpg" width={200} height={150} unoptimized />);
    const img = screen.getByRole('img');
    expect(img.getAttribute('src')).toBe('/static/photo.jpg');
    expect(img.getAttribute('src')).not.toContain('/api/next-image');
  });

  it('data: URL src is always unoptimized', () => {
    const dataUrl = 'data:image/png;base64,abc123';
    render(<Image alt="test" src={dataUrl} width={100} height={100} />);
    const img = screen.getByRole('img');
    expect(img.getAttribute('src')).toBe(dataUrl);
  });
});

describe('<Image /> — config script injection', () => {
  afterEach(cleanup);

  it('injects a config script tag into the DOM', () => {
    document.body.innerHTML = '';
    render(<Image alt="test" src="/photo.jpg" width={100} height={100} />);
    const script = document.querySelector('script');
    expect(script).not.toBeNull();
    expect(script!.innerHTML).toContain('__STRAPI_IMAGE_CONFIG__');
  });

  it('config script contains deviceSizes and imageSizes', () => {
    document.body.innerHTML = '';
    render(<Image alt="test" src="/photo.jpg" width={100} height={100} />);
    const script = document.querySelector('script');
    const json = JSON.parse(script!.innerHTML.replace('window.__STRAPI_IMAGE_CONFIG__=', ''));
    expect(Array.isArray(json.deviceSizes)).toBe(true);
    expect(Array.isArray(json.imageSizes)).toBe(true);
  });

  it('config script contains valid JSON (no unescaped </script> sequences)', () => {
    document.body.innerHTML = '';
    render(<Image alt="test" src="/photo.jpg" width={100} height={100} />);
    const script = document.querySelector('script');
    const raw = script!.innerHTML;
    // The safeJsonForScript helper replaces < with \u003c so the JSON is safe
    expect(raw).not.toContain('</script>');
    // Verify the JSON parses correctly after stripping the assignment
    const json = JSON.parse(raw.replace('window.__STRAPI_IMAGE_CONFIG__=', ''));
    expect(json).toHaveProperty('deviceSizes');
    expect(json).toHaveProperty('imageSizes');
    expect(json).toHaveProperty('formats');
  });
});
