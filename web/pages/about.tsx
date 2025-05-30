import { TRADE_TERM } from 'common/envs/constants'
import { capitalize } from 'lodash'
import { AboutManifold } from 'web/components/about-manifold'
import { ExplainerPanel } from 'web/components/explainer-panel'
import { Col } from 'web/components/layout/col'
import { Page } from 'web/components/layout/page'
import { ManifoldLogo } from 'web/components/nav/manifold-logo'
import { SEO } from 'web/components/SEO'
import { Title } from 'web/components/widgets/title'
import { LabCard } from './lab'
import { Socials } from 'web/components/socials'

export default function AboutPage() {
  return (
    <Page trackPageView={'about page'} className="!col-span-7">
      <SEO
        title="About"
        description={`Manifold is a prediction market platform. Users place ${TRADE_TERM}s on an upcoming event which creates a probability of how likely it will happen. ${capitalize(
          TRADE_TERM
        )} on current events, politics, tech, & AI with play money. Or create your own prediction market for others to trade on!`}
      />

      <Col className=" p-4">
        <Title className="hidden sm:flex">About</Title>
        <ManifoldLogo className="mb-4 flex sm:hidden" />
        <Col className="gap-4">
          <div>
            <AboutManifold className="text-lg" />
          </div>

          <ExplainerPanel className={'max-w-full'} showWhatIsManifold={false} />

          <div>
            <h2 className={'text-ink-600 mb-2 text-xl'}>Intro video</h2>
            <div className="mb-1 text-lg">
              Everything you need to know in 7 minutes presented by an animated
              corgi:
            </div>
            <iframe
              src="https://www.youtube.com/embed/DB5TfX7eaVY?start=9"
              className="mb-4 h-80 w-full max-w-2xl"
            ></iframe>
          </div>

          <div>
            <h2 className={'text-ink-600 mb-2 text-xl'}>Our mission</h2>
            <div className="mb-1 text-lg">
              <li>
                Provide the most accurate, real-time predictions on any event.
              </li>
              <li>
                Combat misleading news by incentivising traders to be fast and
                correct.
              </li>
              <li>
                Help people make more informed decisions by improving their
                model of the future.
              </li>
            </div>
          </div>

          <Socials className="mb-2" />

          <div>
            <h2 className={'text-ink-600 mb-2 text-xl'}>
              Still have questions?
            </h2>

            <div className="mt-4 grid gap-x-2 md:grid-cols-3">
              <LabCard
                title="FAQ"
                href="https://docs.manifold.markets/faq"
                target="_blank"
                description="Answers to common questions"
              />

              <LabCard
                title="Community guidelines"
                href="https://manifoldmarkets.notion.site/New-WIP-Community-Guidelines-2b986d33f0c646478d4921667c272f21"
                target="_blank"
                description="Rules, norms, and expectations"
              />

              <LabCard
                title="Sitemap"
                href="/sitemap"
                description="I can't find something"
              />
            </div>
            <div className="text-lg">
              If you need help with a specific market please tag @mods in a
              comment for help!
            </div>
          </div>
        </Col>
      </Col>
    </Page>
  )
}
