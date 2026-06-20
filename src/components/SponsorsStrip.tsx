import occident from "@/assets/sponsors/occident.png.asset.json";
import iseguros from "@/assets/sponsors/iseguros.png.asset.json";
import costaDaurada from "@/assets/sponsors/costa-daurada-v2.png.asset.json";
import agrumaca from "@/assets/sponsors/agrumaca.jpg.asset.json";
import gde from "@/assets/sponsors/gde.png.asset.json";
import toa from "@/assets/sponsors/toa.png.asset.json";

type Sponsor = {
  name: string;
  url: string;
  /** Visual height in px */
  h?: number;
  /** Necesita mix-blend-mode multiply para fundir fondo blanco */
  blend?: boolean;
};

const ROW_1: Sponsor[] = [
  { name: "Occident", url: occident.url, h: 30, blend: true },
  { name: "iSeguros Online", url: iseguros.url, h: 42, blend: true },
  { name: "Costa Daurada Destinació", url: costaDaurada.url, h: 78, blend: true },
];

const ROW_2: Sponsor[] = [
  { name: "Agrumaca Grup", url: agrumaca.url, h: 26, blend: true },
  { name: "gde innovation partners", url: gde.url, h: 28, blend: true },
  { name: "TOA Shoes", url: toa.url, h: 22, blend: true },
];

function SponsorLogo({ s }: { s: Sponsor }) {
  return (
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
  );
}

export function SponsorsStrip() {
  return (
    <section className="border-y border-[hsl(var(--gg-green))]/20 bg-[hsl(var(--gg-bg-light))]">
      <div className="container py-8">
        <div className="flex flex-col gap-8">
          <p className="text-[10px] font-semibold tracking-[0.3em] uppercase text-[hsl(var(--gg-green))] text-center">
            Patrocinadores oficiales
          </p>

          {/* — Fila 1: protagonistas — */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-10 gap-y-8 items-center justify-items-center">
            {ROW_1.map((s) => (
              <div
                key={s.name}
                className="w-full h-24 flex items-center justify-center bg-[hsl(var(--gg-bg-light))]"
              >
                <SponsorLogo s={s} />
              </div>
            ))}
          </div>

          <div className="h-px bg-[hsl(var(--gg-green))]/10" />

          {/* — Fila 2: más discreta — */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-6 items-center justify-items-center">
            {ROW_2.map((s) => (
              <div
                key={s.name}
                className="w-full h-12 flex items-center justify-center bg-[hsl(var(--gg-bg-light))]"
              >
                <SponsorLogo s={s} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
