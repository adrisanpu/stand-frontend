import './timerDisplay.css'

type Props = {
  value: string
  countingHidden?: boolean
}

export default function TimerDisplay({ value, countingHidden = false }: Props) {
  return (
    <div className="t1mer-clock">
      <div className="t1mer-clock__case">
        <div className="t1mer-clock__screen">
          <p role="timer" aria-live="off" className={`t1mer-clock__digits font-digital tabular-nums${countingHidden ? ' t1mer-clock__digits--counting' : ''}`}>
            {countingHidden ? Array.from(value, (character, index) => (
              <span key={index}>{character}</span>
            )) : value}
          </p>
        </div>
      </div>
    </div>
  )
}
