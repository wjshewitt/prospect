"use client";

import React from "react";
import Link from "next/link";
import { Map } from "lucide-react";

export default function PrivacyPolicyPage() {
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
          <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>
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
              <h2 className="text-2xl font-semibold mb-4">1. Introduction</h2>
              <p className="mb-4">
                At LandVision ("we," "us," or "our"), we are committed to
                protecting your privacy and ensuring the security of your
                personal information. This Privacy Policy explains how we
                collect, use, disclose, and safeguard your information when you
                use our AI-powered land analysis platform.
              </p>
              <p className="mb-4">
                By using our Service, you agree to the collection and use of
                information in accordance with this policy.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">
                2. Information We Collect
              </h2>

              <h3 className="text-xl font-medium mb-3">
                2.1 Personal Information
              </h3>
              <p className="mb-4">
                We may collect the following personal information:
              </p>
              <ul className="list-disc pl-6 mb-4">
                <li>Name and contact information (email address)</li>
                <li>Account credentials (username, password)</li>
                <li>Professional information (company, role, industry)</li>
                <li>Payment information (billing address, payment method)</li>
                <li>Communication preferences</li>
              </ul>

              <h3 className="text-xl font-medium mb-3">2.2 Usage Data</h3>
              <p className="mb-4">
                We automatically collect certain information when you use our
                Service:
              </p>
              <ul className="list-disc pl-6 mb-4">
                <li>IP address and location information</li>
                <li>Browser type and version</li>
                <li>Device information and operating system</li>
                <li>Pages visited and time spent on our Service</li>
                <li>Referral sources and navigation patterns</li>
                <li>Usage statistics and feature interactions</li>
              </ul>

              <h3 className="text-xl font-medium mb-3">
                2.3 Land and Project Data
              </h3>
              <p className="mb-4">
                When you use our land analysis features, we may collect:
              </p>
              <ul className="list-disc pl-6 mb-4">
                <li>Geographic coordinates and property boundaries</li>
                <li>Land survey data and satellite imagery</li>
                <li>Environmental and zoning information</li>
                <li>Project specifications and development plans</li>
                <li>Analysis results and AI-generated insights</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">
                3. How We Use Your Information
              </h2>
              <p className="mb-4">
                We use the collected information for the following purposes:
              </p>
              <ul className="list-disc pl-6 mb-4">
                <li>Provide and maintain our Service</li>
                <li>Process transactions and manage subscriptions</li>
                <li>Personalize your experience and improve our Service</li>
                <li>Generate AI-powered land analysis and insights</li>
                <li>Communicate with you about updates and features</li>
                <li>Provide customer support and technical assistance</li>
                <li>Monitor usage patterns and analyze trends</li>
                <li>Ensure security and prevent fraud</li>
                <li>Comply with legal obligations</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">
                4. Information Sharing and Disclosure
              </h2>
              <p className="mb-4">
                We do not sell, trade, or rent your personal information to
                third parties. We may share your information in the following
                circumstances:
              </p>

              <h3 className="text-xl font-medium mb-3">
                4.1 Service Providers
              </h3>
              <p className="mb-4">
                We may share information with trusted third-party service
                providers who assist us in operating our Service, such as:
              </p>
              <ul className="list-disc pl-6 mb-4">
                <li>Cloud hosting and data storage providers</li>
                <li>Payment processing services</li>
                <li>Analytics and performance monitoring tools</li>
                <li>Customer support platforms</li>
              </ul>

              <h3 className="text-xl font-medium mb-3">
                4.2 Legal Requirements
              </h3>
              <p className="mb-4">
                We may disclose your information if required by law or in
                response to legal processes, such as subpoenas or court orders.
              </p>

              <h3 className="text-xl font-medium mb-3">
                4.3 Business Transfers
              </h3>
              <p className="mb-4">
                In the event of a merger, acquisition, or sale of assets, your
                information may be transferred to the new entity.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">5. Data Security</h2>
              <p className="mb-4">
                We implement appropriate technical and organizational security
                measures to protect your personal information against
                unauthorized access, alteration, disclosure, or destruction.
                These measures include:
              </p>
              <ul className="list-disc pl-6 mb-4">
                <li>Encryption of data in transit and at rest</li>
                <li>Regular security audits and vulnerability assessments</li>
                <li>Access controls and authentication mechanisms</li>
                <li>Secure data centers and infrastructure</li>
                <li>Employee training on data protection practices</li>
              </ul>
              <p className="mb-4">
                However, no method of transmission over the internet or
                electronic storage is 100% secure, and we cannot guarantee
                absolute security.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">
                6. AI and Machine Learning
              </h2>
              <p className="mb-4">
                LandVision uses artificial intelligence and machine learning
                technologies to provide land analysis services. When you use
                these features:
              </p>
              <ul className="list-disc pl-6 mb-4">
                <li>
                  Your data may be processed by AI algorithms to generate
                  insights
                </li>
                <li>
                  We may use aggregated, anonymized data to improve our AI
                  models
                </li>
                <li>
                  AI-generated results are provided as decision-support tools
                </li>
                <li>
                  You should verify critical information through independent
                  means
                </li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">
                7. Cookies and Tracking Technologies
              </h2>
              <p className="mb-4">
                We use cookies and similar tracking technologies to enhance your
                experience with our Service. These technologies help us:
              </p>
              <ul className="list-disc pl-6 mb-4">
                <li>Remember your preferences and settings</li>
                <li>Analyze usage patterns and improve performance</li>
                <li>Provide personalized content and recommendations</li>
                <li>Monitor and prevent security threats</li>
              </ul>
              <p className="mb-4">
                You can control cookie settings through your browser
                preferences, though disabling cookies may affect Service
                functionality.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">8. Data Retention</h2>
              <p className="mb-4">
                We retain your personal information for as long as necessary to
                provide our Service and fulfill the purposes outlined in this
                Privacy Policy, unless a longer retention period is required by
                law. When we no longer need your information, we will securely
                delete or anonymize it.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">
                9. Your Rights and Choices
              </h2>
              <p className="mb-4">
                Depending on your location, you may have the following rights
                regarding your personal information:
              </p>
              <ul className="list-disc pl-6 mb-4">
                <li>
                  <strong>Access:</strong> Request a copy of your personal
                  information
                </li>
                <li>
                  <strong>Correction:</strong> Request correction of inaccurate
                  information
                </li>
                <li>
                  <strong>Deletion:</strong> Request deletion of your personal
                  information
                </li>
                <li>
                  <strong>Portability:</strong> Request transfer of your data to
                  another service
                </li>
                <li>
                  <strong>Opt-out:</strong> Opt-out of marketing communications
                </li>
                <li>
                  <strong>Restriction:</strong> Request limitation of processing
                </li>
              </ul>
              <p className="mb-4">
                To exercise these rights, please contact us using the
                information provided below.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">
                10. International Data Transfers
              </h2>
              <p className="mb-4">
                Your information may be transferred to and processed in
                countries other than your own. We ensure that such transfers
                comply with applicable data protection laws and implement
                appropriate safeguards to protect your information.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">
                11. Children's Privacy
              </h2>
              <p className="mb-4">
                Our Service is not intended for children under 13 years of age.
                We do not knowingly collect personal information from children
                under 13. If we become aware that we have collected personal
                information from a child under 13, we will take steps to delete
                such information.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">
                12. Third-Party Links and Services
              </h2>
              <p className="mb-4">
                Our Service may contain links to third-party websites or
                services that are not owned or controlled by us. This Privacy
                Policy does not apply to these third parties. We encourage you
                to read the privacy policies of any third-party services you
                use.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">
                13. Changes to This Privacy Policy
              </h2>
              <p className="mb-4">
                We may update this Privacy Policy from time to time. We will
                notify you of any changes by posting the new Privacy Policy on
                this page and updating the "Last updated" date. We will also
                provide notice through other means as required by law.
              </p>
              <p className="mb-4">
                Your continued use of the Service after any changes constitutes
                acceptance of the updated Privacy Policy.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">14. Contact Us</h2>
              <p className="mb-4">
                If you have any questions about this Privacy Policy or our data
                practices, please contact us:
              </p>
              <div className="mb-4">
                <p>
                  <strong>Email:</strong> privacy@landvision.com
                </p>
                <p>
                  <strong>Address:</strong> [Company Address]
                </p>
                <p>
                  <strong>Data Protection Officer:</strong> [Contact
                  Information]
                </p>
              </div>
              <p className="mb-4">
                We will respond to your inquiries within 30 days of receipt.
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
