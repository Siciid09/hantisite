import { redirect } from 'next/navigation';

// This is the default page loaded when accessing the root URL ('/')
export default function RootPage() {
  // Immediately redirect the user to the '/dashboard' route
  // In a real app, you might check authentication status here first
  // and redirect to '/login' if not authenticated.
  redirect('/dashboard');

  // We don't need to return any visible content as the redirect happens
  // on the server before the page fully renders.
  // You could optionally return a simple loading indicator or null.
  // return <h1>Loading...</h1>;
}
