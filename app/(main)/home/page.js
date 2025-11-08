import Image from 'next/image';
import Script from 'next/script';
import { Inter } from 'next/font/google';

// 1. Set up the Inter font
const inter = Inter({ subsets: ['latin'] });

// 2. Set up page metadata (title)
export const metadata = {
  title: 'Hantikaab - The Modern Business Operating System',
};

// 3. Define the main page component
export default function Home() {
  return (
    <>
      {/* 4. Add the Tailwind CDN script */}
      <Script src="https://cdn.tailwindcss.com" />
      
      {/* 5. Add the custom Tailwind configuration (for brand colors) */}
      <Script id="tailwind-config">
        {`
          tailwind.config = {
            theme: {
              extend: {
                colors: {
                  'brand-blue': '#2563eb', // blue-600
                  'brand-blue-dark': '#1d4ed8', // blue-800
                  'brand-blue-light': '#dbeafe', // blue-100
                  'brand-blue-bg': '#eff6ff', // blue-50
                  'brand-dark': '#1e293b', // slate-800
                  'brand-gray': '#64748b', // slate-500
                },
                fontFamily: {
                  sans: ['Inter', 'sans-serif'],
                },
              },
            },
          };
        `}
      </Script>

      {/* 6. Add the custom global styles (for the wavy background) */}
      <style dangerouslySetInnerHTML={{ __html: `
        body::before, body::after {
          content: '';
          position: fixed;
          top: 0;
          bottom: 0;
          width: 20%;
          background: linear-gradient(180deg, #bfdbfe, #60a5fa, #2563eb); /* Blue gradient */
          opacity: 0.2;
          z-index: -1;
          filter: blur(80px);
        }
        body::before {
          left: 0;
          transform: skewX(-15deg) translateX(-50%);
        }
        body::after {
          right: 0;
          transform: skewX(15deg) translateX(50%);
        }
      ` }} />

      {/* 7. Main Page Content */}
      {/* We apply the font and base colors to this wrapper div */}
      <div className={`${inter.className} text-brand-dark bg-brand-blue-bg`}>
        
        {/* Container to center the content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* 1. Header / Navigation */}
          <header className="py-6">
            <nav className="flex justify-between items-center">
              {/* Logo & Tagline */}
              <div>
                <a href="#" className="text-3xl font-bold text-brand-dark">Hantikaab</a>
                <p className="text-xs text-brand-gray hidden sm:block">The Modern Business Operating System</p>
              </div>

              {/* Nav Links */}
              <ul className="hidden lg:flex items-center space-x-6">
                <li><a href="#" className="font-bold text-brand-dark">Home</a></li>
                <li><a href="#" className="text-brand-gray hover:text-brand-dark">Product</a></li>
                <li><a href="#" className="text-brand-gray hover:text-brand-dark">Solutions</a></li>
                <li><a href="#" className="text-brand-gray hover:text-brand-dark">Pricing</a></li>
                <li><a href="#" className="text-brand-gray hover:text-brand-dark">Resources</a></li>
                <li><a href="#" className="text-brand-gray hover:text-brand-dark">Blog</a></li>
                <li><a href="#" className="text-brand-gray hover:text-brand-dark">Contact</a></li>
              </ul>

              {/* Auth Buttons */}
              <div className="flex items-center space-x-4">
                <a href="#" className="hidden sm:inline-block text-brand-gray hover:text-brand-dark font-medium">→ Start Free</a>
                <a href="#" className="bg-brand-blue text-white px-5 py-2.5 rounded-lg font-medium shadow-md hover:bg-brand-blue-dark transition-colors">→ Book a Demo</a>
              </div>
            </nav>
          </header>

          <main>

            {/* 2. Hero Section */}
            <section className="py-16 md:py-24">
              <div className="grid md:grid-cols-2 gap-12 items-center">
                {/* Hero Text Content */}
                <div className="space-y-6">
                  <h1 className="text-5xl lg:text-6xl font-extrabold text-brand-dark leading-tight">
                    Run Your Entire Business from One Powerful Platform.
                  </h1>
                  <p className="text-lg text-brand-gray max-w-lg">
                    Hantikaab unifies sales, inventory, finance, and reporting—so you can manage every part of your business with clarity and control.
                  </p>
                  <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 pt-4">
                    <a href="#" className="bg-brand-blue text-white px-8 py-3.5 rounded-lg font-medium shadow-lg hover:bg-brand-blue-dark transition-colors text-center">
                      Start Free
                    </a>
                    <a href="#" className="flex items-center justify-center space-x-2 text-brand-blue font-medium px-8 py-3.5 rounded-lg hover:bg-brand-blue-light/30 transition-colors">
                      {/* Play Icon SVG */}
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd"></path></svg>
                      <span>Watch Demo</span>
                    </a>
                  </div>
                  <div className="pt-8">
                    <p className="text-base text-brand-gray">Trusted by growing businesses to simplify daily operations and boost profit visibility.</p>
                  </div>
                </div>

                {/* Hero Image & UI Elements */}
                <div className="relative">
                  {/* Main Image Container */}
                  <div className="relative bg-white rounded-3xl shadow-2xl p-6 z-10">
                    {/* Floating UI Card: Total Income (from original design) */}
                    <div className="absolute -top-8 -left-12 bg-white p-4 rounded-xl shadow-lg flex items-center space-x-3 z-20">
                      <div className="bg-pink-100 p-2 rounded-lg">
                        <svg className="w-5 h-5 text-pink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0c-1.11 0-2.08-.402-2.599-1M12 16v1m0-1c1.11 0 2.08.402 2.599 1"></path></svg>
                      </div>
                      <div>
                        <p className="text-xs text-brand-gray">Total Income</p>
                        <p className="text-lg font-bold text-brand-dark">$248.00</p>
                      </div>
                    </div>
                    
                    {/* Background Graph Element (from original design) */}
                    <div className="absolute inset-4 bg-brand-blue/80 rounded-2xl -z-10 opacity-80"></div>
                    
                    {/* === NEW IMAGE USED HERE === */}
                    <Image 
                      className="relative aspect-square w-full h-full object-cover rounded-2xl z-0" 
                      src="https://img.freepik.com/free-photo/emotions-people-concept-headshot-serious-looking-handsome-man-with-beard-looking-confident-determined_1258-26730.jpg?semt=ais_hybrid&w=740&q=80" 
                      alt="Business owner using Hantikaab"
                      width={740}
                      height={740}
                      priority={true}
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* 3. About the Problem */}
            <section className="py-16 md:py-24">
              <div className="max-w-3xl mx-auto text-center">
                <h2 className="text-4xl font-bold text-brand-dark mb-6">Business Management Shouldn’t Be This Complicated.</h2>
                <p className="text-lg text-brand-gray mb-6">
                  Most small and mid-sized businesses struggle with scattered data, disconnected tools, and unclear profit tracking. Sales are tracked in notebooks, purchases in WhatsApp, and inventory in spreadsheets. It’s slow, messy, and risky.
                </p>
                <p className="text-lg text-brand-dark font-medium">Hantikaab was built to end that fragmentation.</p>
              </div>
            </section>

            {/* 4. The Solution */}
            <section className="py-16 md:py-24 bg-white rounded-3xl shadow-lg">
              <div className="grid md:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
                <div className="px-6">
                  <h2 className="text-4xl font-bold text-brand-dark mb-6">One System. Total Control.</h2>
                  <p className="text-lg text-brand-gray mb-8">
                    Hantikaab connects every part of your business into one real-time system — from purchases to sales, from expenses to profit reports.
                    No switching between apps, no manual syncing, no lost data. Everything updates instantly across your devices.
                  </p>
                  <ul className="space-y-4">
                    <li className="flex items-center space-x-3">
                      <svg className="w-6 h-6 text-brand-blue flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>
                      <span className="text-brand-gray">Real-time insight into every transaction</span>
                    </li>
                    <li className="flex items-center space-x-3">
                      <svg className="w-6 h-6 text-brand-blue flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>
                      <span className="text-brand-gray">Integrated modules that work together</span>
                    </li>
                    <li className="flex items-center space-x-3">
                      <svg className="w-6 h-6 text-brand-blue flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>
                      <span className="text-brand-gray">Clear profit and loss at a glance</span>
                    </li>
                      <li className="flex items-center space-x-3">
                      <svg className="w-6 h-6 text-brand-blue flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>
                      <span className="text-brand-gray">Simplified workflows that save hours every day</span>
                    </li>
                  </ul>
                </div>
                <div className="px-6">
                  {/* Placeholder for a dashboard screenshot */}
                  <div className="aspect-video bg-brand-blue-light rounded-2xl shadow-inner flex items-center justify-center">
                    <span className="text-brand-blue-dark font-medium">App Screenshot Placeholder</span>
                  </div>
                </div>
              </div>
            </section>

            {/* 5. Core Features Overview */}
            <section className="py-16 md:py-24">
              <div className="text-center mb-12">
                <h2 className="text-4xl font-bold text-brand-dark">Everything You Need to Run a Modern Business.</h2>
              </div>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                {/* Feature Block 1 */}
                <div className="bg-white p-8 rounded-2xl shadow-lg">
                  <div className="p-3 bg-brand-blue-light rounded-full text-brand-blue-dark w-min mb-4">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H7a3 3 0 00-3 3v8a3 3 0 003 3z"></path></svg>
                  </div>
                  <h3 className="text-2xl font-bold mb-2">Sales & POS</h3>
                  <p className="text-brand-gray">Fast, reliable, and designed for real-world business operations.</p>
                </div>
                {/* Feature Block 2 */}
                <div className="bg-white p-8 rounded-2xl shadow-lg">
                  <div className="p-3 bg-brand-blue-light rounded-full text-brand-blue-dark w-min mb-4">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4-8-4V7l8-4 8 4zM4 7v10l8 4 8-4V7"></path></svg>
                  </div>
                  <h3 className="text-2xl font-bold mb-2">Inventory Control</h3>
                  <p className="text-brand-gray">Track stock in real time, avoid shortages, and reduce waste.</p>
                </div>
                {/* Feature Block 3 */}
                <div className="bg-white p-8 rounded-2xl shadow-lg">
                  <div className="p-3 bg-brand-blue-light rounded-full text-brand-blue-dark w-min mb-4">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12 12 0 0012 21.69a12 12 0 008.618-15.724z"></path></svg>
                  </div>
                  <h3 className="text-2xl font-bold mb-2">Finance & Accounting</h3>
                  <p className="text-brand-gray">Automated profit and expense tracking without spreadsheets.</p>
                </div>
                {/* Feature Block 4 */}
                <div className="bg-white p-8 rounded-2xl shadow-lg">
                  <div className="p-3 bg-brand-blue-light rounded-full text-brand-blue-dark w-min mb-4">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                  </div>
                  <h3 className="text-2xl font-bold mb-2">Customer Debts & Payments</h3>
                  <p className="text-brand-gray">Manage credits, repayments, and client balances with transparency.</p>
                </div>
                {/* Feature Block 5 */}
                <div className="bg-white p-8 rounded-2xl shadow-lg">
                  <div className="p-3 bg-brand-blue-light rounded-full text-brand-blue-dark w-min mb-4">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
                  </div>
                  <h3 className="text-2xl font-bold mb-2">Reports & Insights</h3>
                  <p className="text-brand-gray">Turn complex data into clear visual summaries that guide better decisions.</p>
                </div>
              </div>
              <p className="text-center text-lg text-brand-gray mt-12">All modules are seamlessly connected—so your data flows automatically where it needs to go.</p>
            </section>
            
            {/* 6. How It Works */}
            <section className="py-16 md:py-24">
              <div className="text-center mb-12">
                <h2 className="text-4xl font-bold text-brand-dark">A Seamless Workflow from Purchase to Profit.</h2>
              </div>
              <div className="grid md:grid-cols-5 gap-8 text-center">
                {/* Step 1 */}
                <div>
                  <div className="flex items-center justify-center w-16 h-16 bg-brand-blue-light text-brand-blue-dark font-bold text-2xl rounded-full mx-auto mb-4">1</div>
                  <h4 className="font-semibold text-lg mb-2">Add Suppliers & Products</h4>
                  <p className="text-brand-gray text-sm">Add suppliers and products.</p>
                </div>
                {/* Step 2 */}
                <div>
                  <div className="flex items-center justify-center w-16 h-16 bg-brand-blue-light text-brand-blue-dark font-bold text-2xl rounded-full mx-auto mb-4">2</div>
                  <h4 className="font-semibold text-lg mb-2">Record Purchases</h4>
                  <p className="text-brand-gray text-sm">Record purchases and update stock automatically.</p>
                </div>
                {/* Step 3 */}
                <div>
                  <div className="flex items-center justify-center w-16 h-16 bg-brand-blue-light text-brand-blue-dark font-bold text-2xl rounded-full mx-auto mb-4">3</div>
                  <h4 className="font-semibold text-lg mb-2">Sell Products</h4>
                  <p className="text-brand-gray text-sm">Sell products with flexible pricing and currency support.</p>
                </div>
                {/* Step 4 */}
                <div>
                  <div className="flex items-center justify-center w-16 h-16 bg-brand-blue-light text-brand-blue-dark font-bold text-2xl rounded-full mx-auto mb-4">4</div>
                  <h4 className="font-semibold text-lg mb-2">Track Finances</h4>
                  <p className="text-brand-gray text-sm">Track income, expenses, and debts in one place.</p>
                </div>
                {/* Step 5 */}
                <div>
                  <div className="flex items-center justify-center w-16 h-16 bg-brand-blue-light text-brand-blue-dark font-bold text-2xl rounded-full mx-auto mb-4">5</div>
                  <h4 className="font-semibold text-lg mb-2">View Live Reports</h4>
                  <p className="text-brand-gray text-sm">View live reports showing profit, cash flow, and performance.</p>
                </div>
              </div>
              <p className="text-center text-lg text-brand-dark font-medium mt-12">Every action you take in Hantikaab updates the entire system instantly.</p>
            </section>

            {/* 7. Technology & Reliability */}
            <section className="py-16 md:py-24 bg-white rounded-3xl shadow-lg">
              <div className="max-w-4xl mx-auto text-center px-6">
                <h2 className="text-4xl font-bold text-brand-dark mb-6">Built for Performance, Security, and Scale.</h2>
                <p className="text-lg text-brand-gray mb-10">
                  Hantikaab is powered by a modern, cloud-based infrastructure ensuring speed, reliability, and data protection.
                  Each business operates in a secure environment with role-based access, encrypted authentication, and automatic data backups.
                </p>
                <div className="grid md:grid-cols-4 gap-6">
                  <div className="bg-brand-blue-bg p-4 rounded-lg">
                    <h5 className="font-semibold text-brand-dark">Cloud-Hosted</h5>
                    <p className="text-sm text-brand-gray">Access anywhere</p>
                  </div>
                  <div className="bg-brand-blue-bg p-4 rounded-lg">
                    <h5 className="font-semibold text-brand-dark">Secure Auth</h5>
                    <p className="text-sm text-brand-gray">User management</p>
                  </div>
                  <div className="bg-brand-blue-bg p-4 rounded-lg">
                    <h5 className="font-semibold text-brand-dark">Scalable</h5>
                    <p className="text-sm text-brand-gray">Ready for growth</p>
                  </div>
                  <div className="bg-brand-blue-bg p-4 rounded-lg">
                    <h5 className="font-semibold text-brand-dark">Role Permissions</h5>
                    <p className="text-sm text-brand-gray">Team control</p>
                  </div>
                </div>
              </div>
            </section>
            
            {/* 8. Insights & Results */}
            <section className="py-16 md:py-24">
              <div className="grid md:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
                <div className="px-6">
                  <h2 className="text-4xl font-bold text-brand-dark mb-6">From Chaos to Clarity.</h2>
                  <p className="text-lg text-brand-gray mb-8">
                    Businesses using Hantikaab report immediate improvement in efficiency, accuracy, and visibility.
                    With all financial and inventory data connected, owners make faster, smarter decisions—and teams work with confidence.
                  </p>
                  <p className="text-lg text-brand-dark font-medium">Know exactly where your business stands—at any moment.</p>
                </div>
                <div className="px-6 space-y-4">
                  <div className="bg-white p-6 rounded-xl shadow-md">
                    <p className="text-3xl font-bold text-brand-blue mb-1">60%</p>
                    <p className="text-brand-dark font-medium">faster daily operations</p>
                  </div>
                  <div className="bg-white p-6 rounded-xl shadow-md">
                    <p className="text-3xl font-bold text-brand-blue mb-1">30%</p>
                    <p className="text-brand-dark font-medium">higher profit visibility</p>
                  </div>
                  <div className="bg-white p-6 rounded-xl shadow-md">
                    <p className="text-3xl font-bold text-brand-blue mb-1">100%</p>
                    <p className="text-brand-dark font-medium">data accuracy across modules</p>
                  </div>
                </div>
              </div>
            </section>

            {/* 9. Testimonials */}
            <section className="py-16 md:py-24">
              <div className="text-center mb-12">
                <h2 className="text-4xl font-bold text-brand-dark">What Business Owners Are Saying.</h2>
              </div>
              <div className="grid lg:grid-cols-3 gap-8">
                {/* Quote 1 */}
                <div className="bg-white p-8 rounded-2xl shadow-lg">
                  <p className="text-brand-gray text-lg mb-6">“Hantikaab replaced three different systems we were using. Now everything is faster and fully connected.”</p>
                  <p className="font-bold text-brand-dark">Business Owner</p>
                  <p className="text-sm text-brand-gray">Retail Sector</p>
                </div>
                {/* Quote 2 */}
                <div className="bg-white p-8 rounded-2xl shadow-lg">
                  <p className="text-brand-gray text-lg mb-6">“Before Hantikaab, tracking stock and debts was a nightmare. Now I see everything in one place.”</p>
                  <p className="font-bold text-brand-dark">Operations Manager</p>
                  <p className="text-sm text-brand-gray">Trading</p>
                </div>
                {/* Quote 3 */}
                <div className="bg-white p-8 rounded-2xl shadow-lg">
                  <p className="text-brand-gray text-lg mb-6">“The best business tool I’ve used in years. It saves me time every single day.”</p>
                  <p className="font-bold text-brand-dark">Store Owner</p>
                  <p className="text-sm text-brand-gray">Services</p>
                </div>
              </div>
            </section>

            {/* 10. Pricing */}
            <section className="py-16 md:py-24">
              <div className="max-w-3xl mx-auto text-center mb-12">
                <h2 className="text-4xl font-bold text-brand-dark">Simple, Transparent Plans.</h2>
                <p className="text-lg text-brand-gray mt-4">
                  Start free, then choose the plan that fits your growth.
                  Every plan includes full access to all modules, secure cloud storage, and real-time data synchronization.
                </p>
              </div>

              {/* Pricing Cards Grid */}
              <div className="grid lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
                {/* Pricing Card: Starter */}
                <div className="bg-white p-8 rounded-2xl shadow-lg border-2 border-gray-100 flex flex-col">
                  <h3 className="text-2xl font-bold mb-2 text-brand-dark">Starter</h3>
                  <p className="text-lg text-brand-gray mb-4">For small teams just getting started.</p>
                  <p className="text-4xl font-bold mb-6 text-brand-dark">$19<span className="text-base font-normal text-brand-gray">/mo</span></p>
                  <ul className="space-y-3 text-brand-gray mb-10 flex-grow">
                    <li className="flex items-center space-x-2">
                      <svg className="w-5 h-5 text-brand-blue" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>
                      <span>All Core Modules</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <svg className="w-5 h-5 text-brand-blue" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>
                      <span>3 Users</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <svg className="w-5 h-5 text-brand-blue" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>
                      <span>Standard Support</span>
                    </li>
                  </ul>
                  <a href="#" className="w-full text-center bg-gray-100 text-brand-dark px-6 py-3 rounded-lg font-medium hover:bg-gray-200 transition-colors">Get Started</a>
                </div>
                
                {/* Pricing Card: Professional - Highlighted */}
                <div className="bg-brand-blue p-8 rounded-2xl shadow-2xl text-white flex flex-col scale-105 transform">
                  <h3 className="text-2xl font-bold mb-2">Professional</h3>
                  <p className="text-lg opacity-90 mb-4">For growing businesses that need control.</p>
                  <p className="text-4xl font-bold mb-6">$49<span className="text-base font-normal opacity-80">/mo</span></p>
                  <ul className="space-y-3 mb-10 flex-grow">
                    <li className="flex items-center space-x-2">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>
                      <span>All Core Modules</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>
                      <span>10 Users</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>
                      <span>Advanced Analytics</span>
                    </li>
                      <li className="flex items-center space-x-2">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>
                      <span>Priority Support</span>
                    </li>
                  </ul>
                  <a href="#" className="w-full text-center bg-white text-brand-blue px-6 py-3 rounded-lg font-medium hover:bg-gray-100 transition-colors">Start Free Trial</a>
                </div>
                
                {/* Pricing Card: Enterprise */}
                <div className="bg-white p-8 rounded-2xl shadow-lg border-2 border-gray-100 flex flex-col">
                  <h3 className="text-2xl font-bold mb-2 text-brand-dark">Enterprise</h3>
                  <p className="text-lg text-brand-gray mb-4">For multi-branch operations & integrations.</p>
                  <p className="text-4xl font-bold mb-6 text-brand-dark">Custom</p>
                  <ul className="space-y-3 text-brand-gray mb-10 flex-grow">
                    <li className="flex items-center space-x-2">
                      <svg className="w-5 h-5 text-brand-blue" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>
                      <span>Unlimited Users</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <svg className="w-5 h-5 text-brand-blue" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>
                      <span>Multi-Branch Control</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <svg className="w-5 h-5 text-brand-blue" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>
                      <span>Custom Integrations</span>
                    </li>
                  </ul>
                  <a href="#" className="w-full text-center bg-gray-100 text-brand-dark px-6 py-3 rounded-lg font-medium hover:bg-gray-200 transition-colors">Contact Us</a>
                </div>
              </div>
              <div className="text-center mt-12">
                  <a href="#" className="text-brand-blue font-medium hover:text-brand-blue-dark">Compare Plans →</a>
              </div>
            </section>
            
            {/* 11. Final CTA */}
            <section className="py-24 text-center">
                <h2 className="text-4xl font-bold text-brand-dark max-w-2xl mx-auto">Your Business Deserves a Smarter System.</h2>
                <p className="text-lg text-brand-gray max-w-xl mx-auto mt-6 mb-10">
                  Join hundreds of business owners using Hantikaab to streamline operations, reduce errors, and unlock real growth.
                </p>
                <a href="#" className="bg-brand-blue text-white px-10 py-4 rounded-lg font-medium text-lg shadow-lg hover:bg-brand-blue-dark transition-colors">
                  Start Now — It’s Free to Try
                </a>
            </section>

          </main>

        </div>

        {/* Footer */}
        <footer className="bg-white/50 border-t border-gray-200/60 mt-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <div className="flex flex-col md:flex-row justify-between items-center">
              {/* Logo & Copyright */}
              <div className="text-center md:text-left mb-6 md:mb-0">
                <a href="#" className="text-3xl font-bold text-brand-dark mb-2 inline-block">Hantikaab</a>
                <p className="text-brand-gray">&copy; 2024 Hantikaab. All rights reserved.</p>
              </div>
              {/* Footer Links */}
              <div className="flex flex-wrap justify-center md:justify-end gap-x-6 gap-y-2 text-brand-gray font-medium">
                <a href="#" className="hover:text-brand-dark">Product</a>
                <a href="#" className="hover:text-brand-dark">Pricing</a>
                <a href="#" className="hover:text-brand-dark">Resources</a>
                <a href="#" className="hover:text-brand-dark">Blog</a>
                <a href="#" className="hover:text-brand-dark">Contact</a>
                <a href="#" className="hover:text-brand-dark">Terms</a>
                <a href="#" className="hover:text-brand-dark">Privacy</a>
              </div>
            </div>
          </div>
        </footer>

      </div>
    </>
  );
}