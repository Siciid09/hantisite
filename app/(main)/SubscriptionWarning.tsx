"use client";

import React, { Fragment, useState } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { AlertTriangle, LogOut } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebaseConfig";
import { useRouter } from "next/navigation";

export default function SubscriptionWarning() {
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const router = useRouter();

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  return (
    <>
      <div className="flex h-screen w-full flex-col items-center justify-center bg-gray-100 p-4 dark:bg-gray-900">
        <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 text-center shadow-lg dark:border-gray-700 dark:bg-gray-800">
          <AlertTriangle className="mx-auto h-16 w-16 text-yellow-500" />
          <h1 className="mt-6 text-2xl font-bold text-gray-900 dark:text-white">
            Subscription Expired
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Your Hantikaab plan has expired. Please renew your subscription to continue using the app.
          </p>
          <button
            onClick={() => setIsPopupOpen(true)}
            className="mt-8 w-full rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-md hover:bg-blue-700"
          >
            Renew Subscription
          </button>

          <button
            onClick={handleLogout}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </div>

      {/* Renew Popup */}
      <Transition appear show={isPopupOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setIsPopupOpen(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/60" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-sm transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all dark:bg-gray-800">
                  <Dialog.Title className="text-lg font-medium text-gray-900 dark:text-white">
                    Contact Us to Renew
                  </Dialog.Title>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Direct Pay is only available on the mobile app. Please contact us on WhatsApp to renew your plan.
                    </p>
                  </div>
                  <div className="mt-4 space-y-2">
                    <a
                      href="https://wa.me/252653227084"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-500 px-4 py-2 text-sm font-medium text-white hover:bg-green-600"
                    >
                      <FaWhatsapp className="h-5 w-5" />
                      Contact via WhatsApp (65 3227084)
                    </a>
                    <div className="text-center text-sm text-gray-500 dark:text-gray-400">
                      or call 63 3227084
                    </div>
                  </div>
                  <div className="mt-6 flex justify-end">
                    <button
                      type="button"
                      className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                      onClick={() => setIsPopupOpen(false)}
                    >
                      Close
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </>
  );
}
