export default function PrintLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-dvh bg-white text-black">
      <style>{`
        @media print {
          @page { margin: 14mm 12mm; }
        }
      `}</style>
      {children}
    </div>
  );
}
