type PlayerCountry = { code: string | null; count: number }

const COUNTRY_CENTERS: Record<string, [longitude: number, latitude: number]> = {
  AL: [20, 41], AD: [1.6, 42.5], AM: [45, 40], AT: [14, 47.5], AZ: [47.5, 40.5],
  BA: [17.8, 44], BE: [4.7, 50.5], BG: [25, 42.7], BY: [28, 53], CH: [8.2, 46.8],
  CY: [33.4, 35], CZ: [15.5, 49.8], DE: [10.5, 51], DK: [9.5, 56], EE: [25.5, 58.7],
  ES: [-4, 40], FI: [26, 64], FO: [-6.9, 62], FR: [2, 46], GB: [-2, 54], GE: [43.5, 42],
  GG: [-2.6, 49.5], GI: [-5.35, 36.1], GR: [22, 39], HR: [16.4, 45.1], HU: [19.5, 47.2],
  IE: [-8, 53], IM: [-4.5, 54.2], IS: [-19, 65], IT: [12.5, 42.5], JE: [-2.1, 49.2],
  KZ: [68, 48], LI: [9.5, 47.1], LT: [24, 55.2], LU: [6.1, 49.8], LV: [24.5, 57],
  MC: [7.4, 43.7], MD: [28.5, 47], ME: [19.3, 42.7], MK: [21.7, 41.6], MT: [14.4, 35.9],
  NL: [5.3, 52], NO: [10, 62], PL: [19, 52], PT: [-8, 39.5], RO: [25, 46], RU: [100, 60],
  RS: [21, 44], SE: [16, 62], SI: [14.9, 46.1], SK: [19.5, 48.7], SM: [12.5, 43.9],
  TR: [35, 39], UA: [32, 49], VA: [12.45, 41.9], XK: [21, 42.5],
}

const CONTINENTS = [
  [[-168, 70], [-145, 72], [-130, 55], [-124, 48], [-117, 32], [-105, 25], [-97, 18],
    [-82, 9], [-78, 25], [-70, 45], [-58, 48], [-52, 56], [-65, 66], [-85, 74], [-115, 75]],
  [[-81, 12], [-70, 10], [-61, 4], [-50, -2], [-35, -10], [-42, -23], [-52, -34],
    [-65, -55], [-73, -42], [-77, -20]],
  [[-52, 60], [-43, 61], [-36, 70], [-44, 82], [-56, 83], [-62, 75]],
  [[-10, 36], [0, 45], [5, 55], [15, 60], [30, 70], [55, 68], [70, 75], [110, 70],
    [140, 60], [160, 55], [170, 45], [150, 35], [130, 32], [120, 20], [110, 5],
    [100, 0], [95, 10], [80, 8], [75, 20], [60, 25], [50, 40], [40, 42], [35, 35],
    [25, 35], [20, 38], [15, 38], [10, 36]],
  [[-17, 37], [10, 37], [32, 30], [40, 12], [50, 10], [44, -12], [35, -25],
    [20, -35], [10, -34], [0, -20], [-8, -5], [-15, 10]],
  [[112, -11], [130, -12], [153, -25], [145, -39], [130, -44], [115, -34]],
  [[-73, 60], [-58, 58], [-52, 65], [-60, 68]],
] as const

const MAP_WIDTH = 720
const MAP_HEIGHT = 300

function project([longitude, latitude]: readonly [number, number]) {
  return {
    x: (longitude + 180) / 360 * MAP_WIDTH,
    y: (90 - latitude) / 180 * MAP_HEIGHT,
  }
}

function continentPath(points: readonly (readonly [number, number])[]) {
  return points.map((point, index) => {
    const { x, y } = project(point)
    return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ') + ' Z'
}

export default function PlayerCountriesMap({ countries, countryName, percentageFormat, playerCount, t }: {
  countries: PlayerCountry[]
  countryName: (code: string) => string
  percentageFormat: Intl.NumberFormat
  playerCount: number
  t: (spanish: string, english?: string) => string
}) {
  const mappedCountries = countries.flatMap(country => {
    if (!country.code) return []
    const center = COUNTRY_CENTERS[country.code]
    return center ? [{ ...country, center, name: countryName(country.code) }] : []
  })

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <svg role="img" aria-label={t('Mapa de países de los jugadores', 'Player country map')}
        viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} className="h-40 w-full shrink-0 text-textSub sm:h-44">
        <rect width={MAP_WIDTH} height={MAP_HEIGHT} rx="12" fill="currentColor" opacity=".04" />
        {CONTINENTS.map((points, index) => <path key={index} d={continentPath(points)}
          fill="currentColor" opacity=".12" stroke="currentColor" strokeOpacity=".22" strokeWidth="1" />)}
        {mappedCountries.map(({ code, count, center, name }) => {
          const { x, y } = project(center)
          const percentage = playerCount ? count / playerCount * 100 : 0
          return <circle key={code} cx={x} cy={y} r={Math.min(4 + Math.sqrt(count), 9)}
            fill="var(--color-primary, #FF931F)" stroke="var(--color-background, #FAF8F4)" strokeWidth="2">
            <title>{`${name}: ${count} (${percentageFormat.format(percentage)}%)`}</title>
          </circle>
        })}
      </svg>
      <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1 text-sm">
        {countries.map(({ code, count }) => {
          const name = code ? countryName(code) : t('Desconocido', 'Unknown')
          const percentage = playerCount ? count / playerCount * 100 : 0
          return <li key={code ?? 'unknown'} className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate">{name}</span>
            <span className="shrink-0 tabular-nums">
              {count} ({percentageFormat.format(percentage)}%)
            </span>
          </li>
        })}
      </ul>
    </div>
  )
}
