export default function Loading() {
  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="skeleton h-8 w-48 rounded" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-24 rounded-md" />
        ))}
      </div>
      <div className="skeleton h-64 w-full rounded-md" />
    </div>
  )
}
