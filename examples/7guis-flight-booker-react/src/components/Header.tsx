function Header({ children }: { children: React.ReactNode }) {
  return (
    <header>
      <h1>{children}</h1>
    </header>
  );
}
export default Header;
