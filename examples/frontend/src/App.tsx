import { useEffect, useState } from 'react';
import Image, {
  getImageProps,
  createStrapiLoader,
  type StrapiMedia,
} from 'strapi-next-image';

interface StrapiFile extends StrapiMedia {
  name: string;
}

function App() {
  const [files, setFiles] = useState<StrapiFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/upload/files')
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.json();
      })
      .then((data) => {
        setFiles(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) return <p className="message">Loading media from Strapi...</p>;

  if (error) {
    return (
      <div className="message">
        <h2>Could not connect to Strapi</h2>
        <p>Make sure the Strapi example app is running on port 1337:</p>
        <pre>cd examples/strapi && npm run develop</pre>
        <p className="error">{error}</p>
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="message">
        <h2>No images found</h2>
        <p>
          Upload some images via the Strapi admin panel at{' '}
          <a href="http://localhost:1337/admin" target="_blank" rel="noreferrer">
            localhost:1337/admin
          </a>{' '}
          (Media Library), then refresh this page.
        </p>
      </div>
    );
  }

  const first = files[0];
  const second = files.length > 1 ? files[1] : first;

  return (
    <div className="app">
      <h1>strapi-next-image — Visual Test</h1>
      <p className="subtitle">
        {files.length} image{files.length !== 1 ? 's' : ''} loaded from Strapi
      </p>

      <Section title="1. Basic Image" description="StrapiMedia object with auto width/height/alt">
        <Image
          src={first}
          alt={first.alternativeText || first.name}
          sizes="(max-width: 768px) 100vw, 600px"
        />
      </Section>

      <Section title="2. Fill Mode" description="Image with fill prop inside a relative container">
        <div className="fill-container">
          <Image
            src={first}
            alt={first.alternativeText || first.name}
            fill
            sizes="600px"
            style={{ objectFit: 'cover' }}
          />
        </div>
      </Section>

      <Section title="3. Priority / Preload" description="Image with priority prop (check <head> for <link rel='preload'>)">
        <Image
          src={second}
          alt={second.alternativeText || second.name}
          sizes="(max-width: 768px) 100vw, 600px"
          priority
        />
      </Section>

      <Section title="4. Blur Placeholder" description="Image with blurDataURL — observe the fade-in transition">
        {first.blurDataURL ? (
          <Image
            src={first}
            alt={first.alternativeText || first.name}
            sizes="(max-width: 768px) 100vw, 600px"
            placeholder="blur"
          />
        ) : (
          <p className="description">
            No blurDataURL on this image. Upload a new image via the Strapi admin
            — the plugin generates blur placeholders automatically on upload.
          </p>
        )}
      </Section>

      <Section title="5. Custom Quality" description="Image rendered at quality={75}">
        <Image
          src={first}
          alt={first.alternativeText || first.name}
          sizes="(max-width: 768px) 100vw, 600px"
          quality={75}
        />
      </Section>

      <Section title="6. Unoptimized" description="Bypasses optimization, serves original file">
        <Image
          src={first}
          alt={first.alternativeText || first.name}
          sizes="(max-width: 768px) 100vw, 600px"
          unoptimized
        />
      </Section>

      <Section title="7. getImageProps()" description="Using the utility for a custom <picture> element">
        <GetImagePropsDemo media={first} />
      </Section>

      <Section title="8. Custom Loader" description="Using createStrapiLoader() with explicit base URL">
        <CustomLoaderDemo media={first} />
      </Section>

      <Section title="9. Manual String src" description="Plain URL string with explicit width/height">
        <Image
          src={first.url}
          alt={first.alternativeText || first.name}
          width={first.width}
          height={first.height}
          sizes="(max-width: 768px) 100vw, 600px"
        />
      </Section>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="demo-section">
      <h2>{title}</h2>
      <p className="description">{description}</p>
      <div className="demo-content">{children}</div>
    </section>
  );
}

function GetImagePropsDemo({ media }: { media: StrapiFile }) {
  const { props } = getImageProps({
    src: media,
    alt: media.alternativeText || media.name,
    sizes: '(max-width: 768px) 100vw, 600px',
  });

  // Remove fetchPriority to avoid React 18 DOM warning
  const { fetchPriority: _, ...imgProps } = props;

  return (
    <div>
      <picture>
        <source srcSet={imgProps.srcSet} sizes={imgProps.sizes} />
        <img {...imgProps} />
      </picture>
      <details>
        <summary>Generated props</summary>
        <pre>{JSON.stringify(props, null, 2)}</pre>
      </details>
    </div>
  );
}

function CustomLoaderDemo({ media }: { media: StrapiFile }) {
  const loader = createStrapiLoader('http://localhost:1337');

  return (
    <Image
      src={media}
      alt={media.alternativeText || media.name}
      sizes="(max-width: 768px) 100vw, 600px"
      loader={loader}
    />
  );
}

export default App;
