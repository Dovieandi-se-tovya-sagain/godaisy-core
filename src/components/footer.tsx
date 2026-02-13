// components/footer.tsx

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer data-theme="corporate" className="w-full bg-base-200 text-base-content">
      <div className="footer max-w-7xl mx-auto p-10 grid grid-cols-1 md:grid-cols-3 gap-8">
        <aside className="space-y-2">
          <img src="/little-daisy.png" alt="Go Daisy" width={40} height={40} style={{ width: 40, height: 40 }} />
          <img src="/go-daisy-logo.png" alt="Go Daisy logo" width={112} height={28} style={{ width: 112, height: 28 }} />
        </aside>

        <div className="grid grid-cols-2 gap-6">
          <nav className="grid grid-flow-row gap-2" aria-label="Support links">
            <a href="/support" className="block hover:underline hover:text-primary" style={{ color: '#1f2937' }}>Support Go Daisy</a>
            <a href="/HowWeDoIt" className="block hover:underline hover:text-primary" style={{ color: '#1f2937' }}>How we do it</a>
            <a href="/whether-weather" className="block hover:underline hover:text-primary" style={{ color: '#1f2937' }}>Sorry about the weather</a>
            <a href="/AboutUs" className="block hover:underline hover:text-primary" style={{ color: '#1f2937' }}>About us</a>
          </nav>

          <nav className="grid grid-flow-row gap-2" aria-label="Legal links">
            <a href="/TermsAndConditions" className="block hover:underline hover:text-primary" style={{ color: '#1f2937' }}>Terms of use</a>
            <a href="/PrivacyPolicy" className="block hover:underline hover:text-primary" style={{ color: '#1f2937' }}>Privacy policy</a>
            <a href="/CookiePolicy" className="block hover:underline hover:text-primary" style={{ color: '#1f2937' }}>Cookie policy</a>
          </nav>
        </div>

        <nav className="md:text-right">
          <p className="text-sm text-gray-600">Get out there!</p>
          <p className="text-xs text-gray-500">© {year} Go Daisy. All rights reserved.</p>
        </nav>
      </div>
    </footer>
  );
}