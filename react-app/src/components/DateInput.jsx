import { useState, useEffect } from 'react'

function ymdToDmy(ymd) {
  if (!ymd || ymd.length < 10) return ''
  const [y, m, d] = ymd.split('-')
  return `${d}/${m}/${y}`
}

export default function DateInput({ value, onChange, className = 'input', style = {}, placeholder = 'dd/mm/yyyy' }) {
  const [text, setText] = useState(() => ymdToDmy(value))

  useEffect(() => { setText(ymdToDmy(value)) }, [value])

  function handleChange(e) {
    let v = e.target.value.replace(/[^\d/]/g, '')
    if (v.length === 2 && !v.includes('/')) v = v + '/'
    if (v.length === 5 && v.split('/').length < 3) v = v + '/'
    setText(v)
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) {
      const [d, m, y] = v.split('/')
      onChange(`${y}-${m}-${d}`)
    } else if (!v) {
      onChange('')
    }
  }

  return (
    <input
      className={className}
      style={style}
      value={text}
      placeholder={placeholder}
      maxLength={10}
      onChange={handleChange}
    />
  )
}
