"use client";

import React from "react";
import Link from "next/link";
import { Map } from "lucide-react";

export default function TermsOfUsePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center gap-2">
              <Map className="h-8 w-8 text-primary" />
              <span className="text-2xl font-bold">LandVision</span>
            </Link>
            <div className="flex items-center gap-4">
              <Link
                href="/login"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Sign In
              </Link>
              <Link
                href="/signup"
                className="text-sm bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90"
              >
                Sign Up
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold mb-8">Terms of Use</h1>
          <p className="text-muted-foreground mb-8">
            Last updated:{" "}
            {new Date().toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>

          <div className="prose prose-lg max-w-none">
            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">
                1. Acceptance of Terms
              </h2>
              <p className="mb-4">
                By accessing and using LandVision ("the Service"), you accept
                and agree to be bound by the terms and provision of this
                agreement. If you do not agree to abide by the above, please do
                not use this service.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">
                2. Description of Service
              </h2>
              <p className="mb-4">
                LandVision is an AI-powered land analysis platform that provides
                real estate developers, urban planners, and land analysts with
                advanced tools for:
              </p>
              <ul className="list-disc pl-6 mb-4">
                <li>AI-powered land analysis and risk assessment</li>
                <li>Interactive 3D visualization and mapping</li>
                <li>Environmental impact evaluation</li>
                <li>Zoning and regulatory compliance analysis</li>
                <li>Real-time market intelligence</li>
                <li>Project planning and development optimization</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">3. User Accounts</h2>
              <p className="mb-4">
                To access certain features of the Service, you must register for
                an account. When you register, you agree to:
              </p>
              <ul className="list-disc pl-6 mb-4">
                <li>Provide accurate and complete information</li>
                <li>Maintain the security of your password and account</li>
                <li>
                  Accept responsibility for all activities under your account
                </li>
                <li>Notify us immediately of any unauthorized use</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">
                4. Acceptable Use Policy
              </h2>
              <p className="mb-4">You agree not to use the Service to:</p>
              <ul className="list-disc pl-6 mb-4">
                <li>Violate any applicable laws or regulations</li>
                <li>Infringe on intellectual property rights</li>
                <li>Transmit harmful, threatening, or offensive content</li>
                <li>Attempt to gain unauthorized access to our systems</li>
                <li>Use the service for any fraudulent or illegal purposes</li>
                <li>Interfere with or disrupt the service or servers</li>
                <li>Reverse engineer or attempt to extract source code</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">
                5. Intellectual Property
              </h2>
              <p className="mb-4">
                The Service and its original content, features, and
                functionality are owned by LandVision and are protected by
                international copyright, trademark, patent, trade secret, and
                other intellectual property laws.
              </p>
              <p className="mb-4">
                You retain ownership of any data, content, or materials you
                upload to the Service. By uploading content, you grant us a
                limited license to use, store, and process your data solely for
                providing the Service.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">
                6. AI and Data Usage
              </h2>
              <p className="mb-4">
                LandVision uses artificial intelligence and machine learning
                technologies to analyze land data. While we strive for accuracy,
                AI-generated insights should be used as decision-support tools
                and not as the sole basis for critical business decisions.
              </p>
              <p className="mb-4">You acknowledge that:</p>
              <ul className="list-disc pl-6 mb-4">
                <li>AI analysis results may contain inaccuracies</li>
                <li>
                  You should verify critical information through independent
                  means
                </li>
                <li>
                  LandVision is not liable for decisions made based on AI
                  insights
                </li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">
                7. Data Privacy and Security
              </h2>
              <p className="mb-4">
                Your privacy is important to us. Please review our Privacy
                Policy, which also governs your use of the Service, to
                understand our practices regarding the collection and use of
                your personal information.
              </p>
              <p className="mb-4">
                We implement industry-standard security measures to protect your
                data, but no method of transmission over the internet is 100%
                secure.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">
                8. Service Availability
              </h2>
              <p className="mb-4">
                While we strive to provide continuous service, we do not
                guarantee that the Service will be available at all times. We
                reserve the right to modify, suspend, or discontinue the Service
                with or without notice.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">
                9. Limitation of Liability
              </h2>
              <p className="mb-4">
                In no event shall LandVision, its directors, employees, or
                agents be liable for any indirect, incidental, special,
                consequential, or punitive damages, including without
                limitation, loss of profits, data, use, goodwill, or other
                intangible losses, resulting from your use of the Service.
              </p>
              <p className="mb-4">
                Our total liability shall not exceed the amount paid by you for
                the Service in the twelve months preceding the claim.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">
                10. Indemnification
              </h2>
              <p className="mb-4">
                You agree to defend, indemnify, and hold harmless LandVision and
                its licensee and licensors, and their employees, contractors,
                agents, officers and directors, from and against any and all
                claims, damages, obligations, losses, liabilities, costs or
                debt, and expenses (including but not limited to attorney's
                fees).
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">11. Termination</h2>
              <p className="mb-4">
                We may terminate or suspend your account and access to the
                Service immediately, without prior notice or liability, for any
                reason whatsoever, including without limitation if you breach
                the Terms.
              </p>
              <p className="mb-4">
                Upon termination, your right to use the Service will cease
                immediately.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">12. Governing Law</h2>
              <p className="mb-4">
                These Terms shall be interpreted and governed by the laws of the
                jurisdiction in which LandVision operates, without regard to
                conflict of law provisions.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">
                13. Changes to Terms
              </h2>
              <p className="mb-4">
                We reserve the right to modify or replace these Terms at any
                time. If a revision is material, we will try to provide at least
                30 days notice prior to any new terms taking effect.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">
                14. Contact Information
              </h2>
              <p className="mb-4">
                If you have any questions about these Terms, please contact us
                at:
              </p>
              <p className="mb-4">
                Email: legal@landvision.com
                <br />
                Address: [Company Address]
              </p>
            </section>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-muted/50 mt-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center gap-2 mb-4 md:mb-0">
              <Map className="h-6 w-6 text-primary" />
              <span className="text-lg font-semibold">LandVision</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link href="/privacy" className="hover:text-foreground">
                Privacy Policy
              </Link>
              <Link href="/terms" className="hover:text-foreground">
                Terms of Use
              </Link>
              <span>© 2025 LandVision. All rights reserved.</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
