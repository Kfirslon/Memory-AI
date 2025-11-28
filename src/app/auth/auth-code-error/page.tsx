'use client'

import Link from 'next/link'

export default function AuthCodeError() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center p-4 text-center">
            <h1 className="text-2xl font-bold text-red-500 mb-4">Authentication Error</h1>
            <p className="mb-8 text-gray-600">
                There was an error verifying your email or logging you in.
                <br />
                The link may have expired or is invalid.
            </p>
            <Link
                href="/"
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
                Return Home
            </Link>
        </div>
    )
}
