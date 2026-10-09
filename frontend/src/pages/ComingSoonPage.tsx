export default function ComingSoonPage({ title }: { title: string }) {
  return (
    <div className="rounded-lg bg-white p-8 text-center shadow-sm ring-1 ring-gray-200">
      <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
      <p className="mt-2 text-gray-600">Esta sección estará disponible muy pronto.</p>
    </div>
  )
}
