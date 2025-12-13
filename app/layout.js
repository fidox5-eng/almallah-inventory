export default function RootLayout({ children }) {
  return (
    <html className="dark">
      <body style={{ background:'#0a0a0a', color:'#fff' }}>
        {children}
      </body>
    </html>
  );
}