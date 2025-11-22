// File: app/(auth)/login/page.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebaseConfig'; 
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth'; 
import { Mail, Lock, Loader2 } from 'lucide-react'; 
import { FaWhatsapp } from 'react-icons/fa'; 
import Image from "next/image"; 
// Import the hook to check global state
// Adjust path if your contexts folder is elsewhere (e.g. ../../contexts/AuthContext)
import { useAuth } from '@/app/contexts/AuthContext'; 

const Logo = () => (
  <div className="flex items-center space-x-2">
    <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center shadow-md p-1">
      <Image
        src="/logo1.png"       
        alt="Hantikaab Logo"
        width={40}
        height={40}
        className="object-contain"
        priority
      />
    </div>
    <span className="text-3xl font-bold text-white">HantiKaab BizPOS</span>
  </div>
);

const LoginPage = () => {
  const { user } = useAuth(); // Get global user state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);
  
  const router = useRouter(); 

  // --- AUTOMATIC REDIRECT ---
  // This waits until AuthContext has finished creating the cookie
  // and setting the user object.
  useEffect(() => {
    if (user) {
      router.push('/dashboard');
    }
  }, [user, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setResetSent(false);

    try {
      // We strictly just sign in here.
      // The AuthContext listener will detect this, create the cookie,
      // and then update the 'user' state, triggering the useEffect above.
      await signInWithEmailAndPassword(auth, email, password);
      
      // NOTE: Do NOT router.push here. It causes the race condition.
      
    } catch (err: any) {
      setIsLoading(false); // Only stop loading on error
      // Handle errors
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Invalid email or password. Please try again.');
      } else {
        setError('An unexpected error occurred. Please try again later.');
      }
      console.error("Login error:", err);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Please enter your email in the field above to reset your password.');
      return;
    }
    setError(null);
    setResetSent(false);
    setIsLoading(true); 

    try {
      await sendPasswordResetEmail(auth, email); 
      setResetSent(true);
      setError(null);
    } catch (err: any) {
      if (err.code === 'auth/user-not-found') {
        setError('No account found with this email address.');
      } else {
        setError('Failed to send reset email. Please try again.');
      }
      console.error("Forgot password error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 grid md:grid-cols-2">
      
      {/* --- Branding Column (Left) --- */}
      <div className="hidden md:flex flex-col justify-between p-12 bg-gradient-to-br from-blue-600 to-indigo-800 text-white">
        <div>
          <Logo />
        </div>
        <div>
          <h1 className="text-4xl font-bold leading-tight mb-4">
            Welcome Back to HantiKaab
          </h1>
          <p className="text-lg text-blue-100">
           The all-in-one Business Management Platform to centralize your operations.
          </p>
        </div>
        <div className="text-sm text-blue-200">
          © {new Date().getFullYear()} Hantikaab. All rights reserved.
        </div>
      </div>

      {/* --- Form Column (Right) --- */}
      <div className="flex items-center justify-center p-8 bg-white dark:bg-gray-900">
        <div className="max-w-md w-full space-y-8">
          
         {/* Mobile-only Logo */}
        <div className="md:hidden flex justify-center">
          <div className="flex items-center space-x-2">
            <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center shadow-md p-1">
              <Image
                src="/logo1.png"     
                alt="Hantikaab Logo"
                width={40}
                height={40}
                className="object-contain"
                priority
              />
            </div>
            <span className="text-3xl font-bold text-gray-900 dark:text-white">HantiKaab</span>
          </div>
        </div>

          <div>
            <h2 className="text-3xl font-extrabold text-center text-gray-900 dark:text-white">
              Log in to your account
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
              Please enter your credentials to continue
            </p>
          </div>

          {/* Error & Success Messages */}
          {error && (
            <div className="bg-red-100 dark:bg-red-900/20 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg relative" role="alert">
              <span className="block sm:inline">{error}</span>
            </div>
          )}
          {resetSent && (
            <div className="bg-green-100 dark:bg-green-900/20 border border-green-400 dark:border-green-600 text-green-700 dark:text-green-300 px-4 py-3 rounded-lg relative" role="alert">
              <span className="block sm:inline">Password reset link sent to your email!</span>
            </div>
          )}

          <form className="mt-8 space-y-6" onSubmit={handleLogin}>
            
            {/* Email Input */}
            <div>
              <label htmlFor="email" className="text-sm font-medium text-gray-700 dark:text-gray-300 sr-only">
                Email address
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-blue-600 transition-colors">
                  <Mail className="w-5 h-5" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email address"
                  className="appearance-none block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-700 rounded-lg placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:border-blue-500 sm:text-sm transition"
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label htmlFor="password" className="text-sm font-medium text-gray-700 dark:text-gray-300 sr-only">
                Password
              </label>
              <div className="relative group">
                 <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-blue-600 transition-colors">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="appearance-none block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-700 rounded-lg placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:border-blue-500 sm:text-sm transition"
                />
              </div>
            </div>

            {/* Forgot Password Button */}
            <div className="flex items-center justify-end">
              <div className="text-sm">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={isLoading}
                  className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 focus:outline-none focus:underline"
                >
                  Forgot your password?
                </button>
              </div>
            </div>

            {/* Login Button */}
            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors disabled:bg-blue-400 dark:disabled:bg-blue-700 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="animate-spin w-5 h-5 mr-3" />
                    Signing in...
                  </>
                ) : (
                  'Sign in'
                )}
              </button>
            </div>
          </form>

          {/* WhatsApp Support Link */}
          <div className="text-center mt-10">
            <a
              href="https://wa.me/252653227084"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white group transition-colors"
            >
              <FaWhatsapp className="w-5 h-5 mr-2 text-green-500 transition-transform group-hover:scale-110" />
              Have an issue? Contact Support
            </a>
          </div>

        </div>
      </div>

    </div>
  );
};

export default LoginPage;