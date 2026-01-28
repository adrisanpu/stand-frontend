import { Link } from 'react-router-dom'
import { ThemeProvider } from '../core/theme'
import { useStandLogo } from '../core/logoUtils'

export default function Privacy() {
  const standLogo = useStandLogo()

  return (
    <ThemeProvider game={null}>
      <div className="min-h-screen bg-club text-textMain font-sans px-6 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="card p-6 sm:p-8">
            <div className="flex flex-col items-center mb-8">
              <Link to="/login" className="mb-4">
                <img
                  src={standLogo}
                  alt="Stand"
                  className="h-12 w-auto object-contain opacity-90 hover:opacity-100"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    target.src = '/stand-logo.png'
                  }}
                />
              </Link>
              <h1 className="text-2xl font-bold text-textMain">Privacy Policy</h1>
            </div>

            <div className="max-w-none space-y-6 text-textMain text-sm sm:text-base">
              <p className="text-textSub leading-relaxed">
                Stand (&quot;we&quot;, &quot;our&quot;, &quot;us&quot;) provides interactive games and experiences for live events, accessible through Instagram and web interfaces. This Privacy Policy explains how we collect, use, and protect personal data when users interact with Stand.
              </p>

              <section>
                <h2 className="text-lg font-semibold text-textMain mt-8 mb-2">1. Information We Collect</h2>
                <p className="text-textSub leading-relaxed mb-4">
                  We collect only the information necessary to operate the service and deliver the game experience.
                </p>

                <h3 className="text-base font-medium text-textMain mt-4 mb-2">a. Information You Provide</h3>
                <p className="text-textSub font-medium mb-1">Instagram Interaction Data</p>
                <p className="text-textSub leading-relaxed mb-3">
                  When you interact with Stand through Instagram (e.g. sending messages or participating in games), we may collect: Instagram user identifiers (such as PSID), Instagram username, message content related to the game.
                </p>
                <p className="text-textSub font-medium mb-1">Game Participation Data</p>
                <p className="text-textSub leading-relaxed mb-3">
                  During a game or event, we may collect: Player identifiers (playerId), validation codes, quiz answers and quiz completion status, scores, timers, or rankings (depending on the game), raffle eligibility and winner status.
                </p>
                <p className="text-textSub font-medium mb-1">Communications</p>
                <p className="text-textSub leading-relaxed">
                  If you contact us directly (email or support), we may collect your contact details and message content.
                </p>

                <h3 className="text-base font-medium text-textMain mt-4 mb-2">b. Information We Automatically Collect</h3>
                <p className="text-textSub font-medium mb-1">Usage Data</p>
                <p className="text-textSub leading-relaxed mb-3">
                  Basic information about how the service is used, such as game interactions and system events, for debugging and improvement.
                </p>
                <p className="text-textSub font-medium mb-1">Technical Data</p>
                <p className="text-textSub leading-relaxed mb-3">
                  Limited technical data such as timestamps, API requests, and error logs. We do not perform cross-site tracking or advertising profiling.
                </p>

                <h3 className="text-base font-medium text-textMain mt-4 mb-2">c. Information From Third Parties</h3>
                <p className="text-textSub font-medium mb-1">Meta / Instagram Platforms</p>
                <p className="text-textSub leading-relaxed">
                  We receive limited data from Meta Platforms (Instagram) strictly to enable messaging, game participation, and webhook-based interactions. We do not receive access to private Instagram profile information beyond what is required to operate the service.
                </p>
              </section>

              <section>
                <h2 className="text-lg font-semibold text-textMain mt-8 mb-2">2. How We Use Your Information</h2>
                <p className="text-textSub leading-relaxed">
                  We use collected information to: operate and manage live games and interactive experiences; assign players, validate participation, and calculate scores or results; run quizzes and raffles during events; send automated game-related messages via Instagram; ensure system security and prevent abuse; improve reliability and performance of the service; comply with legal obligations and platform policies (Meta / Instagram).
                </p>
              </section>

              <section>
                <h2 className="text-lg font-semibold text-textMain mt-8 mb-2">3. How We Share Your Information</h2>
                <p className="text-textSub leading-relaxed mb-3">
                  We do not sell or rent personal data. Information may be shared only in these cases:
                </p>
                <p className="text-textSub leading-relaxed mb-1"><strong>Service Providers:</strong> With trusted infrastructure providers (e.g. AWS) solely to host and operate the service.</p>
                <p className="text-textSub leading-relaxed mb-1"><strong>Legal Compliance:</strong> When required by law, regulation, or valid governmental request.</p>
                <p className="text-textSub leading-relaxed mb-3"><strong>Business Transfers:</strong> If Stand is involved in a merger, acquisition, or asset sale, data may be transferred as part of that transaction.</p>
                <p className="text-textSub leading-relaxed">
                  All third parties are required to protect data and use it only for the intended purpose.
                </p>
              </section>

              <section>
                <h2 className="text-lg font-semibold text-textMain mt-8 mb-2">4. Data Retention</h2>
                <p className="text-textSub leading-relaxed mb-3">
                  We retain personal data only for as long as necessary to operate the event or game. Game and interaction data is typically short-lived and tied to specific events. You may request deletion of your data at any time.
                </p>
                <p className="text-textSub leading-relaxed mb-1">Data deletion requests:</p>
                <p className="text-textSub leading-relaxed">📧 Contact: support@stand.games</p>
                <p className="text-textSub leading-relaxed text-sm mt-1">Please include your Instagram username and the event or game you participated in.</p>
              </section>

              <section>
                <h2 className="text-lg font-semibold text-textMain mt-8 mb-2">5. Data Security</h2>
                <p className="text-textSub leading-relaxed mb-3">
                  We implement industry-standard security measures, including: encrypted connections (HTTPS/TLS), secure cloud infrastructure (AWS), access control and limited internal permissions.
                </p>
                <p className="text-textSub leading-relaxed">
                  No system is 100% secure, but we take reasonable steps to protect your data.
                </p>
              </section>

              <section>
                <h2 className="text-lg font-semibold text-textMain mt-8 mb-2">6. Your Rights</h2>
                <p className="text-textSub leading-relaxed">
                  Depending on your jurisdiction, you may have the right to: access your personal data, request correction or deletion, object to or restrict processing. To exercise these rights, contact support@stand.games. We will respond within a reasonable timeframe.
                </p>
              </section>

              <section>
                <h2 className="text-lg font-semibold text-textMain mt-8 mb-2">7. Cookies and Tracking</h2>
                <p className="text-textSub leading-relaxed">
                  Stand does not use advertising cookies. Limited technical cookies or local storage may be used to ensure correct functionality of the web interface.
                </p>
              </section>

              <section>
                <h2 className="text-lg font-semibold text-textMain mt-8 mb-2">8. Third-Party Services</h2>
                <p className="text-textSub leading-relaxed">
                  Stand integrates with third-party platforms such as Instagram (Meta Platforms). We are not responsible for the privacy practices of those platforms. Please review their privacy policies before using their services.
                </p>
              </section>

              <section>
                <h2 className="text-lg font-semibold text-textMain mt-8 mb-2">9. Children&apos;s Privacy</h2>
                <p className="text-textSub leading-relaxed">
                  Stand is not intended for children under 13 years of age (or under 16 where applicable). We do not knowingly collect personal data from minors. If such data is identified, it will be deleted promptly.
                </p>
              </section>

              <section>
                <h2 className="text-lg font-semibold text-textMain mt-8 mb-2">10. International Data Transfers</h2>
                <p className="text-textSub leading-relaxed">
                  Stand operates using cloud infrastructure that may process data in different countries. All data transfers comply with applicable data protection laws.
                </p>
              </section>

              <section>
                <h2 className="text-lg font-semibold text-textMain mt-8 mb-2">11. Changes to This Policy</h2>
                <p className="text-textSub leading-relaxed">
                  We may update this Privacy Policy from time to time. The latest version will always be available at this URL.
                </p>
              </section>

              <section>
                <h2 className="text-lg font-semibold text-textMain mt-8 mb-2">12. Contact</h2>
                <p className="text-textSub leading-relaxed">
                  If you have any questions about this Privacy Policy or data handling: 📧 support@stand.games
                </p>
              </section>
            </div>

            <div className="mt-8 pt-6 border-t border-white/10">
              <Link
                to="/login"
                className="inline-block w-full sm:w-auto text-center p-3 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 hover:bg-[rgba(255,255,255,0.1)] transition-all duration-200 font-medium text-textMain"
              >
                Volver
              </Link>
            </div>
          </div>
        </div>
      </div>
    </ThemeProvider>
  )
}
