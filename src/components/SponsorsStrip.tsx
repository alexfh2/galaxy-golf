import occident from "@/assets/sponsors/occident.png.asset.json";
import iseguros from "@/assets/sponsors/iseguros.png.asset.json";
import costaDaurada from "@/assets/sponsors/costa-daurada.png.asset.json";
import agrumaca from "@/assets/sponsors/agrumaca.jpg.asset.json";
import gde from "@/assets/sponsors/gde.png.asset.json";
import toa from "@/assets/sponsors/toa.png.asset.json";

type Sponsor = {
  name: string;
  url: string;
  /** Visual height in px (homogeneizar altura óptica) */
  h?: number;
  /** Necesita mix-blend-mode multiply para fundir fondo blanco */
  blend?: boolean;
};

const SPONSORS: Sponsor[] = [
  { name: "Occident", url: occident.url, h: 28, blend: true },
  { name: "iSeguros Online", url: iseguros.url, h: 22, blend: true },
  { name: "Costa Daurada Golf Destination", url: costaDaurada.url, h: 52, blend: true },
  { name: "Agrumaca Grup", url: agrumaca.url, h: 40, blend: true },
  { name: "gde innovation partners", url: gde.url, h: 48, blend: true },
  { name: "TOA Shoes", url: toa.url, h: 28, blend: true },
];

export function SponsorsStrip() {
  return (
    <section className="border-y border-[hsl(var(--gg-green))]/20 bg-[hsl(var(--gg-bg-light))]">
      <div className="container py-8">
        <div className="flex flex-col gap-6">
          <p className="text-[10px] font-semibold tracking-[0.3em] uppercase text-[hsl(var(--gg-green))] text-center">
            Patrocinadores oficiales
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-8 gap-y-6 items-center justify-items-center">
            {SPONSORS.map((s) => (
              <div
                key={s.name}
                className="w-full h-16 flex items-center justify-center bg-[hsl(var(--gg-bg-light))]"
              >
                <img
                  src={s.url}
                  alt={s.name}
                  loading="lazy"
                  className="max-w-full object-contain"
                  style={{
                    height: s.h ?? 32,
                    mixBlendMode: s.blend ? "multiply" : undefined,
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
