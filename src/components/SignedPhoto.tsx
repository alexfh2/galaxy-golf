import { useEffect, useState } from 'react';
import { signPhotoUrl } from '@/lib/photoUrl';

type Props = React.ImgHTMLAttributes<HTMLImageElement> & {
  src: string | null | undefined;
};

/**
 * Renders an <img> for a photo stored in the private 'photos' bucket.
 * Resolves a signed URL on mount; renders nothing until ready.
 */
export function SignedPhoto({ src, ...rest }: Props) {
  const [resolved, setResolved] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    if (!src) {
      setResolved(undefined);
      return;
    }
    signPhotoUrl(src).then((u) => {
      if (!cancelled) setResolved(u);
    });
    return () => {
      cancelled = true;
    };
  }, [src]);

  if (!resolved) return null;
  return <img src={resolved} {...rest} />;
}
