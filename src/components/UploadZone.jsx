import { useRef, useState } from 'react'

export function UploadZone({ onFile, disabled }) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)

  const handleFile = (file) => {
    if (!file) return
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      onFile(null, 'Please upload a .xlsx or .xls file.')
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => onFile(e.target.result, null)
    reader.onerror = () => onFile(null, 'Failed to read the file.')
    reader.readAsArrayBuffer(file)
  }

  const onDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    handleFile(file)
  }

  const onInputChange = (e) => {
    handleFile(e.target.files?.[0])
    e.target.value = ''
  }

  return (
    <div
      onClick={() => !disabled && inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={`
        border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors select-none
        ${dragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={onInputChange}
        disabled={disabled}
      />
      <div className="text-3xl mb-2">📂</div>
      <p className="text-sm font-medium text-gray-700">
        Drop your ClubGG .xlsx export here
      </p>
      <p className="text-xs text-gray-400 mt-1">or click to browse</p>
    </div>
  )
}
