import { useEffect } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

/* ============================================================
 * Bases y Puntuaciones — Página pública
 * Reglamentos Circuito GalaxyGolf 2026 y GalaxyCup 2026.
 * Sin descarga de PDFs, contenido nativo.
 * ============================================================ */

const SectionTitle = ({
  children,
  accent,
}: {
  children: React.ReactNode;
  accent: 'green' | 'copper';
}) => (
  <h3
    className={`font-display text-2xl md:text-[26px] tracking-tight mt-10 mb-3 ${
      accent === 'green'
        ? 'text-[hsl(var(--gg-green))]'
        : 'text-[hsl(var(--gg-copper))]'
    }`}
  >
    {children}
  </h3>
);

const Eyebrow = ({
  children,
  accent,
}: {
  children: React.ReactNode;
  accent: 'green' | 'copper';
}) => (
  <span
    className={`inline-block text-[10px] font-semibold uppercase tracking-[0.25em] mb-3 ${
      accent === 'green'
        ? 'text-[hsl(var(--gg-green))]'
        : 'text-[hsl(var(--gg-copper))]'
    }`}
  >
    {children}
  </span>
);

const Prose = ({ children }: { children: React.ReactNode }) => (
  <div className="text-[15px] leading-[1.75] text-[hsl(var(--gg-navy-deep))]/85 space-y-3">
    {children}
  </div>
);

const Card = ({
  children,
  accent,
}: {
  children: React.ReactNode;
  accent: 'green' | 'copper';
}) => (
  <div
    className={`bg-[hsl(var(--gg-surface-light))] border border-[hsl(var(--gg-navy-deep))]/10 rounded-sm p-6 md:p-10 shadow-[0_4px_24px_-12px_rgba(11,19,36,0.18)] border-t-2 ${
      accent === 'green'
        ? 'border-t-[hsl(var(--gg-green))]'
        : 'border-t-[hsl(var(--gg-copper))]'
    }`}
  >
    {children}
  </div>
);

const PointsTable = ({
  rows,
  accent,
  caption,
}: {
  rows: (string | number)[][];
  accent: 'green' | 'copper';
  caption?: string;
}) => {
  const headerBg =
    accent === 'green'
      ? 'bg-[hsl(var(--gg-green))]'
      : 'bg-[hsl(var(--gg-copper))]';
  return (
    <div className="my-5 overflow-x-auto -mx-2 px-2">
      {caption && (
        <p className="text-[11px] uppercase tracking-[0.2em] text-[hsl(var(--gg-navy-deep))]/55 mb-2">
          {caption}
        </p>
      )}
      <table className="min-w-full border-collapse text-sm">
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className={
                    ri % 2 === 0
                      ? `${headerBg} text-[hsl(var(--gg-surface-light))] font-semibold text-center px-2 py-2 text-[12px] uppercase tracking-[0.08em] border border-[hsl(var(--gg-surface-light))]/30`
                      : 'bg-[hsl(var(--gg-surface-light))] text-[hsl(var(--gg-navy-deep))] text-center px-2 py-2 border border-[hsl(var(--gg-navy-deep))]/10'
                  }
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const BulletList = ({ items }: { items: React.ReactNode[] }) => (
  <ul className="list-disc pl-5 space-y-1.5 text-[15px] leading-[1.7] text-[hsl(var(--gg-navy-deep))]/85">
    {items.map((it, i) => (
      <li key={i}>{it}</li>
    ))}
  </ul>
);

const Note = ({
  children,
  accent,
}: {
  children: React.ReactNode;
  accent: 'green' | 'copper';
}) => (
  <div
    className={`my-4 px-4 py-3 text-[14px] leading-[1.65] border-l-2 bg-[hsl(var(--gg-cream))]/40 text-[hsl(var(--gg-navy-deep))] ${
      accent === 'green'
        ? 'border-[hsl(var(--gg-green))]'
        : 'border-[hsl(var(--gg-copper))]'
    }`}
  >
    {children}
  </div>
);

function CircuitoContent() {
  return (
    <Card accent="green">
      <Eyebrow accent="green">Reglamentación · Temporada 2026</Eyebrow>
      <h2 className="font-display text-3xl md:text-4xl text-[hsl(var(--gg-navy-deep))] tracking-tight">
        Circuito GalaxyGolf 2026
      </h2>
      <Prose>
        <p className="mt-4">
          El circuito consta de <strong>12 pruebas</strong> y una{' '}
          <strong>Gran Final en INFINITUM GOLF RESORT</strong> que decidirá el
          ganador absoluto del Circuito. La competición está reservada a
          jugadores amateurs de golf con licencia y handicap oficial en vigor
          (RFEG). La modalidad de juego será{' '}
          <strong>Stableford Individual</strong> durante todo el circuito.
        </p>
        <p>
          Los días de juego habitualmente serán viernes, sábado o domingo. Los
          jugadores deberán escoger un sólo día para participar. Si un jugador
          quiere jugar más de un día, sólo se contabilizará el primer resultado
          y contabilizará como prueba adicional jugada.
        </p>
        <p>
          Se cuidarán todos los detalles para crear el circuito con el mejor
          ambiente de golf para el jugador amateur:
        </p>
      </Prose>
      <BulletList
        items={[
          'Catering en la carpa del hoyo 9½ con los mejores productos ibéricos, barbacoa, cooking show, refrescos, cervezas, cava, vino, frutas frescas, tartas y café.',
        ]}
      />

      <SectionTitle accent="green">Inscripciones</SectionTitle>
      <Prose>
        <p>
          La inscripción estará abierta 15 días antes de la disputa de la prueba
          y se podrá hacer de diferentes formas:
        </p>
      </Prose>
      <BulletList
        items={[
          'Llamando al campo correspondiente',
          <>
            Web{' '}
            <a
              href="https://www.galaxygolf.net"
              className="underline decoration-[hsl(var(--gg-green))]/40"
              target="_blank"
              rel="noreferrer"
            >
              www.galaxygolf.net
            </a>{' '}
            · e-mail:{' '}
            <a
              href="mailto:info@galaxygolf.net"
              className="underline decoration-[hsl(var(--gg-green))]/40"
            >
              info@galaxygolf.net
            </a>
          </>,
          'Teléfono: 902 00 25 88 · WhatsApp: 600 066 775',
        ]}
      />

      <SectionTitle accent="green">Categorías del Circuito</SectionTitle>
      <BulletList
        items={[
          'Handicap Indistinto Inferior: hasta 15,4',
          'Handicap Indistinto Superior: a partir de 15,5',
          'Challenge GLX — Malos Golfistas',
        ]}
      />

      <SectionTitle accent="green">Pruebas</SectionTitle>
      <Prose>
        <p>
          El resultado de la prueba para cada jugador vendrá determinado por su
          resultado Stableford. En algunas pruebas, una vez finalizada la misma
          (generalmente el domingo por la tarde), se procederá a la entrega de
          premios y a un extraordinario sorteo de regalos.
        </p>
      </Prose>

      <SectionTitle accent="green">Trofeos y Premios</SectionTitle>
      <Prose>
        <p className="font-medium text-[hsl(var(--gg-navy-deep))]">Por prueba:</p>
      </Prose>
      <BulletList
        items={[
          'Ganador categoría Hcp Inferior indistinto: invitación a la siguiente prueba del Circuito.',
          'Ganador categoría Hcp Superior indistinto: invitación a la siguiente prueba del Circuito.',
        ]}
      />
      <Prose>
        <p className="font-medium text-[hsl(var(--gg-navy-deep))] mt-3">
          Premios especiales:
        </p>
        <p>
          Bolas más cercana indistinta · Lote GolfyVino · Cinturones SKIMP ·
          Material de golf.
        </p>
      </Prose>

      <SectionTitle accent="green">Clasificación General Acumulada</SectionTitle>
      <Prose>
        <p>
          Se sumarán los <strong>7 mejores resultados</strong> de las pruebas
          del Circuito. A este resultado se le sumará{' '}
          <strong>1 punto por cada prueba disputada</strong> durante el
          circuito.
        </p>
        <p>
          <em>Ejemplo:</em> un jugador que haya jugado todas las pruebas del
          circuito y la suma de sus 7 mejores resultados sea 252, su resultado
          general final será 252 + 13 = 265. El mismo jugador, si sólo hubiera
          disputado 3 pruebas, tendría un resultado de 255. En caso de empate
          ganará el hcp más bajo en la primera prueba jugada del Circuito.
        </p>
      </Prose>
      <Note accent="green">
        Los ganadores de cada categoría Hcp (Inferior y Superior) jugarán
        invitados la Final en <strong>INFINITUM GOLF RESORT</strong>, los días{' '}
        <strong>28 y 29 de noviembre</strong>.
      </Note>

      <SectionTitle accent="green">Obsequios Fidelidad Circuito</SectionTitle>
      <Prose>
        <p>
          Este año obsequiaremos a nuestros jugadores más fieles con los
          siguientes premios:
        </p>
      </Prose>
      <BulletList
        items={[
          '5 pruebas jugadas: Polo GALAXYGOLF',
          '10 pruebas jugadas: Funda de madera personalizada COVERSGOLF o similar.',
        ]}
      />
      <Prose>
        <p>
          Se entregarán en la Final del Circuito los días 28 y 29 de noviembre
          en INFINITUM GOLF RESORT.
        </p>
      </Prose>

      <SectionTitle accent="green">Challenge GLX — Malos Golfistas</SectionTitle>
      <Prose>
        <p>
          Este año, en colaboración con el mejor podcast de golf{' '}
          <em>“Malos Golfistas”</em>, haremos un Challenge en el que
          premiaremos a los jugadores que participen en nuestros circuitos y
          tengan una mayor bajada de hándicap durante el año. Se deben jugar un
          mínimo de <strong>5 pruebas</strong> de los circuitos Galaxy.
        </p>
        <p>
          Cogeremos como referencia el hándicap del jugador en el primer torneo
          jugado de uno de nuestros circuitos (GalaxyGolf o GalaxyCup) y, como
          hándicap final, el hándicap del jugador a <strong>25 de octubre de 2026</strong>.
        </p>
        <p>
          Haremos dos categorías según el hcp inicial: Inferior hasta 15,4 /
          Superior a partir de 15,5. Además de obsequiar a los jugadores con
          más bajada de hándicap, los mejores clasificados en este ranking
          tendrán puntos extras en nuestras finales.
        </p>
      </Prose>
      <Note accent="green">
        Los ganadores de cada una de estas categorías del Challenge GLX —
        MALOS GOLFISTAS recibirán un{' '}
        <strong>JAMÓN RESERVA EMBUTIDOS PARIS</strong>.
      </Note>

      <SectionTitle accent="green">
        Final Circuito GalaxyGolf 2026 — INFINITUM GOLF RESORT (28-29 noviembre)
      </SectionTitle>
      <Prose>
        <p>
          La Gran Final del Circuito GalaxyGolf 2026 se celebrará durante el{' '}
          <strong>28 y 29 de noviembre de 2026</strong> en el{' '}
          <strong>INFINITUM GOLF RESORT</strong>.
        </p>
      </Prose>
      <Note accent="green">
        Podrán participar con opción a premio los jugadores del circuito que
        hayan jugado un mínimo de <strong>5 pruebas</strong> del circuito
        durante el año 2026.
      </Note>
      <Prose>
        <p>
          Los vigentes ganadores del Circuito NO podrán repetir premio de
          ganador el año que estén disfrutando del mismo.
        </p>
        <p>
          El resultado final se obtendrá de la suma del resultado obtenido el
          día 28 de noviembre (sábado) y el día 29 de noviembre (domingo), más
          una bonificación según la clasificación general Hcps Inf. y Sup.
          obtenidas (según la siguiente tabla).
        </p>
      </Prose>

      <PointsTable
        accent="green"
        caption="Bonificación según clasificación general"
        rows={[
          ['1º clasificado', '2º clasificado', '3º clasificado', '4º clasificado', '5º clasificado'],
          ['5 puntos', '4 puntos', '3 puntos', '2 puntos', '1 punto'],
        ]}
      />

      <Prose>
        <p>
          <em>Ejemplo:</em> el tercer clasificado de una categoría hace 36 y 34
          puntos Stableford durante la Gran Final. Su resultado final será:
          36 + 34 + 3 = 73. En caso de empate ganará el hcp más bajo en la
          primera prueba jugada de la Final (sábado). En caso de empezar la
          final con el mismo hándicap, ganará el jugador con más puntos en la
          fase regular de la Clasificación Fidelidad.
        </p>
        <p>
          El hándicap de juego del domingo 29 de noviembre será el que
          corresponda a la actualización después de disputar la primera jornada
          de la final del día 28.
        </p>
        <p>
          Se añadirá <strong>1 punto extra</strong> por cada resultado igual o
          superior a 40 puntos que el jugador haya hecho en la clasificación
          general durante el circuito.
        </p>
        <p>
          Se añadirán puntos extra para la Final a los jugadores mejor
          clasificados en el <strong>Challenge GLX — Malos Golfistas</strong>,
          de cada una de las categorías.
        </p>
      </Prose>

      <PointsTable
        accent="green"
        caption="Puntos extra Challenge GLX — Malos Golfistas"
        rows={[
          ['1º', '2º', '3º', '4º', '5º'],
          ['5 puntos', '5 puntos', '4 puntos', '4 puntos', '3 puntos'],
          ['6º', '7º', '8º', '9º', '10º'],
          ['3 puntos', '2 puntos', '2 puntos', '1 punto', '1 punto'],
        ]}
      />

      <SectionTitle accent="green">Premios de la Final</SectionTitle>
      <div className="grid md:grid-cols-2 gap-4 mt-2">
        <div className="border border-[hsl(var(--gg-green))]/25 bg-[hsl(var(--gg-cream))]/40 p-5 rounded-sm">
          <p className="text-[11px] uppercase tracking-[0.22em] text-[hsl(var(--gg-green))] font-semibold">
            1er Clasificado — Categorías Hcp
          </p>
          <p className="mt-2 text-[14px] leading-[1.6] text-[hsl(var(--gg-navy-deep))]">
            Trofeo · Invitación al CIRCUITO GALAXYGOLF 2027 (pruebas
            regulares) · Estancia de golf nacional con greenfees · Zapatos
            TOA SHOES personalizados.
          </p>
        </div>
        <div className="border border-[hsl(var(--gg-green))]/25 bg-[hsl(var(--gg-cream))]/40 p-5 rounded-sm">
          <p className="text-[11px] uppercase tracking-[0.22em] text-[hsl(var(--gg-green))] font-semibold">
            2º Clasificado — Categorías Hcp
          </p>
          <p className="mt-2 text-[14px] leading-[1.6] text-[hsl(var(--gg-navy-deep))]">
            Trofeo · Estancia de golf nacional con greenfees · Jamón Reserva
            Embutidos Paris.
          </p>
        </div>
      </div>
      <Prose>
        <p className="mt-5 text-[13px] text-[hsl(var(--gg-navy-deep))]/70">
          Los premios y trofeos de los ganadores se entregarán en la entrega
          de premios del circuito que se celebrará en INFINITUM GOLF RESORT el
          día 29 de noviembre a las 18:00 h. Las estancias son para un jugador
          en habitación doble compartida. En uso individual, o acompañante, se
          aplicará un suplemento.
        </p>
        <p className="text-[13px] italic text-[hsl(var(--gg-navy-deep))]/60">
          La organización se reserva el derecho a modificar los premios sin
          previo aviso en caso de que los patrocinadores decidan cambiarlos o
          anularlos.
        </p>
      </Prose>
    </Card>
  );
}

function GalaxyCupContent() {
  return (
    <Card accent="copper">
      <Eyebrow accent="copper">Reglamentación · Temporada 2026</Eyebrow>
      <h2 className="font-display text-3xl md:text-4xl text-[hsl(var(--gg-navy-deep))] tracking-tight">
        GalaxyCup 2026
      </h2>
      <Prose>
        <p className="mt-4">
          El circuito consta de <strong>12 pruebas regulares</strong> y{' '}
          <strong>6 pruebas Major</strong> en su primera fase, y{' '}
          <strong>4 de PlayOffs</strong> que decidirán los ganadores absolutos
          del Circuito en cada una de sus categorías. El sistema de puntuación
          está inspirado en la <strong>FedEx Cup</strong>.
        </p>
        <p>
          La competición está reservada a jugadores amateurs de golf con
          licencia y handicap oficial en vigor (RFEG). La modalidad de juego
          será <strong>Stableford Individual</strong>.
        </p>
        <p>
          Los días de juego habitualmente serán viernes, sábado y domingo. Los
          jugadores deberán escoger un sólo día para participar. Si un jugador
          quiere jugar más de un día, sólo se contabilizará el primer resultado.
        </p>
        <p>Se cuidarán todos los detalles para crear el mejor ambiente de golf:</p>
      </Prose>
      <BulletList
        items={[
          'Viernes: catering en la carpa con degustación de productos. Excepcionalmente se ofrecerá pícnic a los jugadores.',
          'Fin de semana: catering en la carpa del hoyo 9 con barbacoa, cooking show, refrescos, cervezas, agua y frutas frescas.',
        ]}
      />

      <SectionTitle accent="copper">Inscripciones</SectionTitle>
      <Prose>
        <p>
          La inscripción estará abierta 15 días antes de la disputa de la
          prueba y se podrá hacer de diferentes formas:
        </p>
      </Prose>
      <BulletList
        items={[
          'Llamando al campo correspondiente',
          <>
            Web{' '}
            <a
              href="https://www.galaxygolf.net"
              className="underline decoration-[hsl(var(--gg-copper))]/40"
              target="_blank"
              rel="noreferrer"
            >
              www.galaxygolf.net
            </a>{' '}
            · e-mail:{' '}
            <a
              href="mailto:info@galaxygolf.net"
              className="underline decoration-[hsl(var(--gg-copper))]/40"
            >
              info@galaxygolf.net
            </a>
          </>,
          'Teléfono: 902 00 25 88 · WhatsApp: 600 066 775',
        ]}
      />

      <SectionTitle accent="copper">Categorías del Circuito</SectionTitle>
      <BulletList
        items={[
          'Handicap Indistinto Inferior: hasta 15,4',
          'Handicap Indistinto Superior: a partir de 15,5',
        ]}
      />

      <SectionTitle accent="copper">Trofeos y Premios</SectionTitle>
      <BulletList
        items={[
          'Ganador de prueba categoría Hcp Individual: invitación a la siguiente prueba de la GalaxyCup.',
          'Ganadores de fase Regular en categoría individual: invitación a las pruebas PlayOff.',
        ]}
      />

      <SectionTitle accent="copper">Obsequios Fidelidad Circuito</SectionTitle>
      <Prose>
        <p>
          Obsequiaremos a nuestros jugadores más fieles con los siguientes
          premios:
        </p>
      </Prose>
      <BulletList
        items={[
          '+ 6 pruebas jugadas: Polo GalaxyGolf',
          '+ 14 pruebas jugadas: Paletilla de jamón GRAN RESERVA Embutidos Paris',
        ]}
      />
      <Prose>
        <p>
          Los premios y trofeos de los ganadores se entregarán el 29 de
          noviembre en la Final del CIRCUITO GALAXYGOLF en INFINITUM GOLF
          RESORT.
        </p>
      </Prose>

      <SectionTitle accent="copper">Challenge GLX — Malos Golfistas</SectionTitle>
      <Prose>
        <p>
          En colaboración con el mejor podcast de golf{' '}
          <em>“Malos Golfistas”</em>, premiaremos a los jugadores que
          participen en nuestros circuitos y tengan una mayor bajada de
          hándicap durante el año.
        </p>
      </Prose>
      <Note accent="copper">
        Se deben jugar un mínimo de <strong>5 pruebas</strong> de los
        circuitos Galaxy.
      </Note>
      <Prose>
        <p>
          Cogeremos como referencia el hándicap del jugador en el primer
          torneo jugado de uno de nuestros circuitos (GalaxyGolf o GalaxyCup)
          y, como hándicap final, el hándicap del jugador a{' '}
          <strong>25 de octubre de 2026</strong>.
        </p>
        <p>
          Haremos dos categorías según el hcp inicial: Inferior hasta 15,4 /
          Superior a partir de 15,5. Además de obsequiar a los jugadores con
          más bajada de hándicap, los mejores clasificados en este ranking
          tendrán puntos extras en nuestras finales.
        </p>
      </Prose>
      <Note accent="copper">
        Los ganadores de cada categoría del Challenge GLX — MALOS GOLFISTAS
        recibirán un <strong>JAMÓN RESERVA EMBUTIDOS PARIS</strong>.
      </Note>

      <SectionTitle accent="copper">
        Fase Regular (Torneos Regulares y Majors)
      </SectionTitle>
      <Prose>
        <p>
          El sistema de puntuación consiste en la acumulación de puntos
          inspirado en la <em>FedEx Cup</em> en función de la posición de cada
          torneo Regular o Major (consultar apartado Tablas). Una vez
          terminada la fase regular, el ranking de puntos servirá para
          otorgar la misma bonificación de golpes para la Fase Final que se
          ha establecido en la FedEx Cup, siendo obviamente el jugador con
          más puntos el que obtenga mayor bonificación de golpes.
        </p>
        <p>
          El jugador permanecerá en la misma categoría en la que juegue la
          primera prueba del Circuito durante toda la Fase Regular. En la
          Fase de PlayOff podría cambiar según el hcp que tenga en el
          momento de iniciar la Fase Final.
        </p>
      </Prose>
      <Note accent="copper">
        Los jugadores que no tengan un mínimo de <strong>5 pruebas</strong>{' '}
        de la Fase Regular de la GalaxyCup no podrán competir en los
        PlayOffs con opción a premio de Ganador del Circuito.
      </Note>

      <PointsTable
        accent="copper"
        caption="Tabla de puntos — Prueba Regular"
        rows={[
          [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
          ['500', '300', '190', '135', '110', '100', '90', '85', '80', '75'],
          [11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
          ['70', '65', '60', '57', '56', '55', '54', '53', '52', '51'],
        ]}
      />

      <PointsTable
        accent="copper"
        caption="Tabla de puntos — Prueba Major"
        rows={[
          [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
          ['750', '450', '285', '200', '165', '150', '135', '125', '120', '115'],
          [11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
          ['110', '105', '100', '90', '85', '80', '75', '70', '65', '60'],
        ]}
      />

      <SectionTitle accent="copper">PlayOff Final GalaxyCup 2026</SectionTitle>
      <Prose>
        <p>
          Los PlayOff de la GalaxyCup 2026 empezarán el fin de semana del{' '}
          <strong>30, 31 de octubre y 1 de noviembre</strong> en{' '}
          <strong>Empordà Forest</strong> y se jugarán durante 4 fines de
          semana seguidos hasta el <strong>21 y 22 de noviembre</strong> de
          2026 en <strong>CAMIRAL GOLF RESORT</strong>.
        </p>
        <p>
          Contabilizarán los <strong>3 mejores resultados Stableford</strong>{' '}
          de los 4 torneos de PlayOff, a los que habrá que sumar los puntos
          extra según la clasificación de la fase Regular, más los puntos
          obtenidos en la clasificación de <em>Malos Golfistas</em>, donde
          premiamos a los jugadores que más bajada de hándicap han tenido
          durante el año.
        </p>
      </Prose>

      <PointsTable
        accent="copper"
        caption="Puntos Stableford extra Fase PlayOff (según clasificación Fase Regular)"
        rows={[
          [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
          ['10', '8', '8', '7', '7', '6', '6', '5', '5', '4'],
          [11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
          ['4', '3', '3', '2', '2', '1', '1', '1', '1', '1'],
        ]}
      />

      <Prose>
        <p>
          En caso de empate final entre varios jugadores, el orden se
          determinará por el jugador con el hcp más bajo el día de la última
          prueba en Camiral, luego por el mejor resultado el día de la final
          y, en caso de seguir el empate, por el jugador que haya jugado más
          pruebas del circuito.
        </p>
        <p>
          La categoría en la que los jugadores jugarán los PlayOffs será
          según el hcp del día de juego del primer torneo de PlayOff
          disputado.
        </p>
      </Prose>

      <SectionTitle accent="copper">Premios de la Final</SectionTitle>
      <div className="grid md:grid-cols-2 gap-4 mt-2">
        <div className="border border-[hsl(var(--gg-copper))]/25 bg-[hsl(var(--gg-cream))]/40 p-5 rounded-sm">
          <p className="text-[11px] uppercase tracking-[0.22em] text-[hsl(var(--gg-copper))] font-semibold">
            1er Clasificado — Categorías Individuales Hcp
          </p>
          <p className="mt-2 text-[14px] leading-[1.6] text-[hsl(var(--gg-navy-deep))]">
            Invitación GALAXYCUP 2027 (pruebas regulares) · Jamón Reserva
            Embutidos Paris.
          </p>
        </div>
        <div className="border border-[hsl(var(--gg-copper))]/25 bg-[hsl(var(--gg-cream))]/40 p-5 rounded-sm">
          <p className="text-[11px] uppercase tracking-[0.22em] text-[hsl(var(--gg-copper))] font-semibold">
            2º Clasificado — Categorías Individuales Hcp
          </p>
          <p className="mt-2 text-[14px] leading-[1.6] text-[hsl(var(--gg-navy-deep))]">
            Invitación GALAXYCUP 2027 (pruebas Major) · Jamón Reserva
            Embutidos Paris.
          </p>
        </div>
      </div>
      <Prose>
        <p className="mt-5 text-[13px] text-[hsl(var(--gg-navy-deep))]/70">
          Los premios y trofeos de los ganadores se entregarán el 29 y 30 de
          noviembre en la Final del CIRCUITO GALAXYGOLF en INFINITUM GOLF
          RESORT. Las estancias de fin de semana son para el ganador en
          habitaciones compartidas. En caso de querer habitación individual o
          con acompañante, se aplicará un suplemento.
        </p>
        <p className="text-[13px] italic text-[hsl(var(--gg-navy-deep))]/60">
          La organización se reserva el derecho a modificar los premios sin
          previo aviso en caso de que los patrocinadores decidan cambiarlos o
          anularlos.
        </p>
      </Prose>
    </Card>
  );
}

export default function BasesYPuntuaciones() {
  useEffect(() => {
    document.title = 'Bases y puntuaciones · GalaxyGolf 2026';
  }, []);

  return (
    <>
      {/* Hero */}
      <section className="relative bg-[hsl(var(--gg-navy-deep))] text-[hsl(var(--gg-surface-light))] overflow-hidden">
        <div className="absolute inset-0 opacity-[0.06] pointer-events-none bg-[radial-gradient(circle_at_30%_20%,hsl(var(--gg-gold))_0%,transparent_55%)]" />
        <div className="container relative py-20 md:py-28">
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[hsl(var(--gg-gold))] mb-4">
            Temporada 2026
          </p>
          <h1 className="font-display text-4xl md:text-6xl tracking-tight max-w-3xl">
            Bases y puntuaciones
          </h1>
          <p className="mt-5 max-w-2xl text-[15px] md:text-base leading-[1.7] text-[hsl(var(--gg-surface-light))]/75">
            Reglamentación oficial del Circuito GalaxyGolf y de la GalaxyCup
            2026: categorías, sistema de puntuación, finales y premios. Todo
            el detalle de cómo se compite a lo largo de la temporada.
          </p>
        </div>
      </section>

      {/* Tabs */}
      <section className="bg-background py-12 md:py-16">
        <div className="container mx-auto px-4">
          <Tabs defaultValue="circuito" className="w-full">
            <TabsList className="mb-8 bg-[hsl(var(--gg-surface-light))] border border-[hsl(var(--gg-navy-deep))]/12 p-1 h-auto rounded-sm shadow-[0_2px_10px_-6px_rgba(11,19,36,0.18)]">
              <TabsTrigger
                value="circuito"
                className="text-[11px] font-semibold uppercase tracking-[0.15em] sm:tracking-[0.2em] px-3 sm:px-5 py-2 rounded-none data-[state=active]:bg-[hsl(var(--gg-green))] data-[state=active]:text-[hsl(var(--gg-surface-light))]"
              >
                Circuito GalaxyGolf
              </TabsTrigger>
              <TabsTrigger
                value="galaxycup"
                className="text-[11px] font-semibold uppercase tracking-[0.15em] sm:tracking-[0.2em] px-3 sm:px-5 py-2 rounded-none data-[state=active]:bg-[hsl(var(--gg-copper))] data-[state=active]:text-[hsl(var(--gg-surface-light))]"
              >
                GalaxyCup
              </TabsTrigger>
            </TabsList>
            <TabsContent value="circuito">
              <CircuitoContent />
            </TabsContent>
            <TabsContent value="galaxycup">
              <GalaxyCupContent />
            </TabsContent>
          </Tabs>

          <p className="mt-10 text-[12px] text-[hsl(var(--gg-navy-deep))]/55 text-center max-w-2xl mx-auto leading-[1.7]">
            Documento informativo basado en la reglamentación oficial 2026.
            La organización puede modificar premios, fechas o condiciones sin
            previo aviso.
          </p>
        </div>
      </section>
    </>
  );
}
