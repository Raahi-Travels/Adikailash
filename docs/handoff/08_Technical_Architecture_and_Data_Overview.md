| HANDOFF 08  /  The Sacred North (provisional working name)Technical Architecture and Data OverviewAn implementation-agnostic map of product modules, data domains, integrations, AI boundaries and non-functional expectations |
| Provides enough technical direction to keep independently built workstreams coherent while deliberately leaving framework, hosting, database and vendor selection to the implementation process. |
| AUDIENCE | Technical leads, coding agents, product managers, data, security and integration teams |
| STATUS | Working Draft v0.1 |
| IMPORTANT | The Sacred North is a provisional working name. Treat all brand elements as replaceable configuration. |
INTERNAL HANDOFF  |  8 AUGUST 2026

## Purpose and architectural stance
This document describes what technical capabilities must exist and how the domains relate, not the final stack or detailed system design. Coding agents should use it to avoid building disconnected pages, duplicate sources of truth or brand-specific one-offs.
The architecture should support a controlled first launch while preserving a path to richer traveller operations, international service, B2B ground handling and eventual integration with the related hill-mobility platform.
| Technical north star: A modular, auditable and content-driven platform in which public claims, lead context, booking states, traveller readiness, route updates and operational actions remain consistent across website, WhatsApp, portal and admin systems. |

## Architectural principles
1. Domain clarity before service complexity. Define journey, departure, lead, booking, traveller, status and vendor consistently before splitting them into many services.
2. One source of truth per business concept. Website, WhatsApp and admin may present the same data differently, but they should not maintain competing versions of status, departure or policy.
3. Content-managed change. Brand, journey copy, dates, prices, tiers, FAQs, status and policies should be editable through governed content or configuration.
4. Human override and auditability. High-stakes automation must be reviewable, reversible and attributable.
5. Mobile and low-bandwidth resilience. The experience should remain useful when media, maps or network quality degrade.
6. Provider replaceability. WhatsApp, CRM, payments, email, analytics and mapping integrations should be bounded so the product is not permanently shaped around one vendor's terminology.
7. Security proportional to sensitivity. Public content, leads, identity documents, payments, health-related disclosures and incidents require different controls.
8. Event visibility. Important transitions should be observable for product, operations and analytics.
9. Brand portability. The provisional brand should be configuration, not architecture.
10. Progressive complexity. Start with a coherent modular application or small set of services; split only when scale, ownership or reliability requires it.

## System context
The product comprises several user-facing and internal experiences connected through shared business domains.
| Experience | Primary users | Main responsibilities |
| Public website | Prospective travellers, families, international visitors, search engines | Discovery, education, status, enquiry and public trust |
| Messaging concierge | Leads, booked travellers and support team | Qualification, lifecycle alerts, conversation and escalation |
| CRM and sales workspace | Sales and growth | Lead ownership, stage, calls, proposals and conversion |
| Traveller portal | Group leads and companions | Booking state, documents, payments, itinerary, updates and support |
| Operations admin | Operations, coordinators, finance and partners | Departures, vendors, readiness, route status, incidents and reconciliation |
| Content and status management | Content and authorised operations staff | Journeys, guides, policies, brand and verified status |
| Analytics and reporting | Founders, product, growth and operations | Funnel, service quality, readiness and economics |
| AI assistance layer | Staff and controlled customer interactions | Grounded answers, summarisation, classification and drafting |

## Logical capability modules
These modules may exist in one application initially. The boundaries matter more than the deployment shape.

### 1. Brand and configuration
Owns:
- Working brand name, descriptor and taglines
- Logo, colours, typography and social links
- Legal entity and operator disclosure defaults
- Support contacts and hours
- Domain and email identities
- Feature flags and regional settings
- Language availability
This module makes a future brand change manageable.

### 2. Content and journey catalogue
Owns:
- Journeys and service tiers
- Destinations and itinerary stages
- Guides, FAQs and journal content
- Media assets and provenance
- Team, local stories and testimonials
- Public policy content
- SEO and social metadata
It should support drafts, review, publishing, last-reviewed dates and role-based approval for sensitive topics.

### 3. Departure and availability
Owns:
- Dated departures
- Capacity and availability state
- Operating partner
- Pricing and reservation conditions
- Public and internal status
- Itinerary version
- Journey and tier association
Departure state should drive both public actions and internal operations.

### 4. Route and status intelligence
Owns:
- Route segments
- Permit, road and destination status
- Verification source and timestamp
- Update history
- Affected journeys and departures
- Public summary and booking-specific impact
- Subscription topics
It should distinguish verified, unverified, stale and expired information.

### 5. Lead and CRM
Owns:
- Contact and consent
- Acquisition attribution
- Journey intent and group context
- Qualification summary
- Stage, owner and next action
- Conversation and call references
- Proposal link
- Loss and nurture reason
A lead converts into or links to a reservation or booking without losing history.

### 6. Messaging and notifications
Owns:
- Channel identities
- Templates and language variants
- Delivery and failure status
- Consent category
- Conversation routing
- Human takeover
- Event-triggered notification requests
- Booking and departure audience selection
The business event should request a message; the provider-specific adapter should deliver it.

### 7. Proposal, reservation and booking
Owns:
- Proposal versions
- Journey, tier, date and price offered
- Reservation conditions and expiry
- Booking lifecycle
- Policy acceptance
- Group lead
- Capacity hold
- Cancellation, transfer and reschedule choices
The system must preserve the offer accepted at the time of payment.

### 8. Traveller and group
Owns:
- Traveller profiles
- Group membership and roles
- Emergency contacts
- Journey-specific required fields
- Support and rooming preferences
- Consents and acknowledgements
Sensitive attributes should be permissioned and minimal.

### 9. Documents and permits
Owns:
- Configurable document requirements
- Secure files or references
- Review states and reasons
- Expiry and validity
- Submission batches
- Operator or authority outcome
- Audit and retention status
Do not expose raw document locations directly to public clients.

### 10. Payments and finance state
Owns product-level financial truth:
- Amount due and paid
- Payment purpose and status
- Invoice or receipt reference
- Refund, credit and transfer state
- Supplier payable summary where needed
- Provider transaction references
Accounting remains the financial system of record if a dedicated accounting system is used. Reconciliation should keep product and finance states aligned.

### 11. Vendor and allocation
Owns:
- Vendors, properties, vehicles, drivers, guides and local staff
- Qualifications and verification records
- Rate or contract references
- Departure assignments
- Rooms, vehicles and guide allocations
- Confirmation and backup state
- Performance history

### 12. Operations, tasks and incidents
Owns:
- Departure readiness domains
- Tasks, owners and due dates
- Blockers and waivers
- Change records
- Communication approvals
- Incidents and restricted notes
- Post-trip closeout

### 13. Traveller portal and trip companion
Presents authorised information from booking, traveller, documents, payments, itinerary, route and messaging domains. It should not create duplicate business state inside a separate portal database without clear synchronisation.

### 14. Analytics and experimentation
Owns or receives:
- Behavioural events
- Funnel transitions
- Campaign attribution
- Operational and readiness metrics
- Experiment assignments
- Data-quality status
Customer-facing actions, CRM transitions and server-confirmed payment/booking events should be distinguishable.

## High-level domain model

### Principal entities
- BrandConfiguration
- LegalEntity
- OperatingPartner
- Journey
- ServiceTier
- Destination
- ItineraryVersion
- ItineraryStage
- RouteSegment
- Departure
- StatusUpdate
- Lead
- Contact
- Consent
- Conversation
- SalesActivity
- Proposal
- Reservation
- Booking
- BookingGroup
- Traveller
- TravellerRequirement
- DocumentSubmission
- PermitSubmission
- Payment
- RefundOrCredit
- Vendor
- Property
- RoomType
- Vehicle
- Driver
- GuideOrCoordinator
- Allocation
- Task
- ReadinessGate
- Communication
- Incident
- PolicyVersion
- MediaAsset
- TestimonialOrStory

### Important relationships
- A journey has many tiers and itinerary versions
- A departure belongs to one journey, one tier and one itinerary version
- A departure may be operated by a separate legal partner
- A route status may affect many route segments, journeys and departures
- A lead may have many interests but one active sales context
- A proposal belongs to a lead and may create a reservation
- A booking contains one group and many travellers
- A traveller may appear in multiple bookings over time
- A document requirement belongs to a journey/departure rule, not only a global checklist
- A departure has many allocations and readiness gates
- A vendor can provide multiple resource types
- A communication targets one or more leads, bookings, travellers, vendors or internal users
- A policy version is accepted by a specific reservation or booking

## Core state transitions

### Lead to traveller
1. Website or message creates a lead with consent and attribution
2. Qualification updates journey, group and date context
3. Human consultation and proposal are recorded
4. Approved reservation invitation is created
5. Payment or approved action creates a reservation
6. Conditions are met and booking becomes confirmed
7. Group lead and travellers are onboarded
8. Booking enters preparation and departure operations
The lead record remains for attribution and relationship history.

### Route update to customer communication
1. Information enters as unverified field or official input
2. Authorised operator reviews it
3. Verified status update is published with timestamp and source type
4. Affected journeys and departures are calculated or selected
5. Public status changes
6. Booking-specific impact is assessed
7. Approved messages are sent to the correct audiences
8. Acknowledgements, choices or follow-up tasks are recorded

### Departure confirmation
1. Departure passes feasibility review
2. Operating partner and commercial conditions are defined
3. Demand or minimum group is assessed
4. Critical suppliers are held or confirmed according to policy
5. Route and permit dependencies are acceptable
6. Authorised owner changes internal and public state
7. Bookings receive confirmation and preparation tasks
No single payment webhook should automatically confirm the entire departure.

## Integration overview

### Messaging
- Official WhatsApp Business Platform or authorised provider
- Email delivery
- SMS or voice fallback for critical messages
- Optional call scheduling or telephony
Integration requirements:
- Template and consent awareness
- Delivery, failure and inbound-message events
- Context preservation
- Human inbox or handoff
- Provider-agnostic message records

### Payments
- Domestic payment gateway
- International payment method later
- Webhook verification
- Refund and reconciliation support
- Invoice or accounting integration
- Idempotent processing and duplicate prevention

### CRM
The CRM may be built, integrated or hybrid. Regardless of vendor, the product needs a stable lead ID, stage, owner, next action, attribution and booking link.

### Content management
- Structured content editing
- Draft and publish workflow
- Media management
- Translation support
- Sensitive-content review
- Preview and scheduled publishing

### Maps and route visualisation
- Basemap or mapping provider
- Custom route segments and markers
- 2D fallback
- Optional terrain or 3D later
- Clear licensing and caching rules

### Document storage
- Private object storage or secure document service
- Signed, time-limited access
- Virus and file-type checks
- Encryption and audit
- Retention and deletion workflow

### Analytics and advertising
- Product analytics
- Web analytics
- Tag or event management
- Advertising conversion interfaces
- CRM and server-side business-event export where lawful
- Consent and privacy controls

### External operational information
- Official notices and manually verified sources
- Weather or route data where useful
- Operating partner and field coordinator inputs
The product should not label third-party data as authoritative without defined verification.

## API and contract direction
Even if the first version is a single application, define clear contracts for:
- Public journey and departure content
- Status summaries
- Lead creation and consent
- Messaging context
- Proposal and reservation
- Payment state
- Traveller tasks and documents
- Departure readiness
- Vendor assignment
- Analytics events
Contracts should use neutral business terms rather than provider-specific labels. Important writes should be idempotent where retries are likely, especially payment, message and webhook workflows.

## Content and configuration strategy

### Content-managed
- Brand and legal footer
- Journey and tier copy
- Itinerary
- Prices and conditions
- Departure dates and state
- Status and updates
- Guides and FAQ
- Policies and versions
- Contact and support information
- Template text

### Code-managed
- Permission logic
- State transition rules
- Validation boundaries
- Security and audit
- Core layout and reusable components
- Integration adapters
- Event and error handling

### Approval-managed
- Route or permit status
- Health and safety content
- Refund and cancellation policy
- Operator disclosure
- High-impact campaigns
- Emergency messaging

## AI capability overview
AI is an assistant over approved data, not a source of operational truth.

### Suitable early uses
- Lead intent classification
- Conversation summarisation
- Suggested approved answers
- Translation drafts
- Content outline and metadata drafts
- Search over approved journey, guide and policy knowledge
- Staff assistance in finding booking or departure context
- Duplicate or missing-data detection
- Post-trip feedback summarisation

### Later uses
- Structured itinerary recommendation based on traveller preferences
- Vendor-risk signals
- Demand clustering
- Proactive readiness-risk detection
- Content opportunity identification
- Multilingual voice concierge

### Required guardrails
- Retrieval from approved current data
- Source or record reference for operational answers
- Confidence or uncertainty handling
- Human takeover
- Logging and evaluation
- Restricted access to sensitive traveller data
- No training reuse without explicit policy
- Prohibition on autonomous medical, legal, permit, refund and emergency decisions

## Security and privacy

### Data classes
| Class | Examples | Control direction |
| Public | Journey pages, published status, guides | Integrity, publishing approval and availability |
| Internal | Vendor rates, readiness notes, internal tasks | Role-based access |
| Personal | Lead contact, traveller profile, emergency contact | Consent, minimisation and access logging |
| Sensitive | Identity documents, health-related disclosures, incidents | Strong access controls, encryption and restricted exports |
| Financial | Payment references, invoices, refunds | Integrity, reconciliation and limited access |
| Secrets | API keys, webhook secrets, credentials | Secret management and rotation |

### Security expectations
- Strong authentication for staff
- Role-based permissions
- Separate customer and staff sessions
- Secure document access
- Encryption in transit and at rest where appropriate
- Audit for sensitive reads and material writes
- Webhook signature verification
- Protection against duplicate financial actions
- Backups and tested recovery
- Environment separation
- Secret rotation and least privilege
- Dependency and vulnerability management
- Privacy-aware logging

## Reliability and resilience

### Public website
- Cacheable and resilient
- Essential pages available even if CRM or messaging is degraded
- Clear fallback when live data cannot be fetched
- No false "open" status on stale data

### Messaging
- Delivery failures visible
- Retry without duplicate commitments
- Manual contact list for critical departure communication

### Payments
- Idempotent webhook processing
- Pending state until verified
- Reconciliation path for ambiguous transactions

### Operations
- Exportable manifests and trip packs for contingency
- Offline or printed emergency information
- Backup contact and supplier records
- Audit of last known state

## Performance and accessibility
- Mobile-first performance budgets should be defined during implementation
- Images must be responsive and appropriately compressed
- Rich maps, video and 3D are optional layers
- Core content and actions require no 3D or animation
- Forms must be keyboard and screen-reader usable
- Status must use text and icon, not colour only
- Support reduced motion
- Hindi and English typography must remain readable
- Traveller portal should function on low-end mobile devices and intermittent networks

## Observability and operational monitoring
Monitor at least:
- Website availability and core page errors
- Lead creation failures
- WhatsApp inbound and outbound delivery failures
- CRM assignment and overdue queues
- Payment webhook and reconciliation errors
- Document upload and access failures
- Route-status freshness
- Departure data inconsistencies
- Notification jobs and audience counts
- Authentication and suspicious access
- Backup and recovery status
Operational dashboards should alert responsible people, not merely collect logs.

## Data quality rules
- A departure must reference a journey and valid tier
- Public departure state must be compatible with payment action
- A verified status requires source type, author and timestamp
- A booking must preserve accepted proposal and policy version
- A confirmed booking must have an accountable operator context
- A traveller document cannot become accepted without a reviewer action
- A payment cannot become paid only from a client-side success screen
- A critical readiness gate cannot be waived without owner and reason
- Customer-facing accommodation must match the allocation or approved substitution language
- Brand and legal display values should come from configuration

## Future hill-mobility integration
The related intercity mobility platform may later share:
- Contact and traveller identity with consent
- Gateway and route concepts
- Commercial vehicle and driver records
- Pickup hubs
- Messaging, payments and support
- Route-risk intelligence
- Empty-leg and demand signals
For now:
- Keep transport concepts neutral and reusable
- Do not expose tourism-sensitive traveller data to mobility without a valid purpose and consent
- Do not make tourism launch dependent on a full mobility marketplace
- Treat regulatory and permit models as separate domains even if some suppliers overlap

## Technical decisions deliberately deferred
Coding agents should propose, not assume:
- Frontend and backend framework
- Hosting and cloud provider
- Monolith versus service split
- Relational database and search technology
- CMS product
- CRM product or custom build
- WhatsApp provider
- Payment provider
- Authentication provider
- Analytics stack
- Map and 3D technology
- Workflow or job system
- AI model and orchestration framework
Recommendations should be evaluated against launch speed, team skill, total cost, data control, provider lock-in, observability and future mobility integration.

## Expected technical-design outputs
Before implementation, the technical lead or coding agent should produce:
- System context diagram
- Domain and ownership map
- User and service roles
- Key state machines
- Data model for the assigned scope
- Integration boundaries and failure behaviour
- Security and privacy considerations
- Analytics event plan
- Content and configuration ownership
- Migration or provider-replacement considerations
- Test strategy and operational fallback

## Non-functional acceptance outcomes
The technical foundation is acceptable when:
1. The working brand can be changed centrally.
2. Public status, booking-specific impact and internal source history remain connected.
3. Website, WhatsApp and CRM share lead and journey context.
4. A payment retry cannot create duplicate reservations or confirmations.
5. Sensitive documents are not public or broadly accessible to staff.
6. A stale route status becomes visibly stale rather than remaining silently "live."
7. Core public pages and traveller trip packs remain useful during a nonessential integration outage.
8. High-stakes state changes and waivers are attributable.
9. Analytics distinguishes behavioural clicks from confirmed business events.
10. The system can add another journey, tier, operator or language without copying the entire product.