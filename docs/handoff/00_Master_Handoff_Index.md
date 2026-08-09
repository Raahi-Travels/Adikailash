| HANDOFF 00  /  The Sacred North (provisional working name)Master Handoff IndexProduct, experience, operations and growth handoff for a technology-enabled Himalayan spiritual travel platform |
| This document explains the complete handoff pack, the shared product language, the decisions already made, the decisions still open, and the boundaries coding agents must respect. |
| AUDIENCE | Founders, product managers, designers, engineers, growth, sales and operations teams |
| STATUS | Working Draft v0.1 |
| IMPORTANT | The Sacred North is a provisional working name. Treat all brand elements as replaceable configuration. |
INTERNAL HANDOFF  |  8 AUGUST 2026

## Purpose of this handoff pack
This pack is the shared product memory for the first version of the spiritual-tourism platform currently using The Sacred North as a working brand. It translates the founders' vision into coordinated directions for product, design, content, growth, sales, traveller experience, operations and engineering.
The pack is intentionally implementation-light. It defines outcomes, responsibilities, information flows, user experience, operational truth and acceptance expectations. Coding agents may propose implementation options, but they should not silently invent business policies, religious claims, cancellation rules, medical guidance, permit guarantees, pricing, regulatory positions or vendor commitments.
| Product north star: Build the most trusted, spiritually sensitive and locally grounded digital gateway for journeys to Adi Kailash, Om Parvat and the sacred landscapes of Kumaon. The platform should make a difficult journey feel understandable, cared for and dignified without commercialising the devotee's faith. |

## How to use the documents
Read the documents in numerical order before starting major work. Each document owns a different part of the product, but all of them share the same definitions and principles.
| File | Primary purpose | Main audience |
| 00_Master_Handoff_Index | Shared assumptions, glossary, priorities and handoff method | Everyone |
| 01_Product_Vision_Customer_and_Service_Blueprint | Customer psychology, value proposition, service model and end-to-end experience | Founders, product, design, operations |
| 02_Brand_UI_UX_and_Content_Language | Provisional brand system, interface direction, voice and religious-language guardrails | Design, content, frontend, growth |
| 03_Public_Website_Information_Architecture_and_Features | Public website structure, page modules, conversion flows and CMS needs | Product, design, frontend, content, SEO |
| 04_WhatsApp_CRM_Sales_and_Lead_Management | Lead capture, qualification, WhatsApp concierge, CRM stages and sales handoff | Product, sales, growth, engineering |
| 05_Traveller_Booking_Portal_and_Trip_Companion | Reservation, passenger data, documents, payments, preparation and during-trip experience | Product, engineering, operations |
| 06_Admin_Operations_Vendor_and_Departure_Management | Back-office workflows for departures, suppliers, permits, incidents and readiness | Operations, product, engineering, finance |
| 07_Growth_SEO_AEO_Content_and_Analytics | Organic discovery, paid acquisition, content engine, attribution and review loops | Growth, content, product, analytics |
| 08_Technical_Architecture_and_Data_Overview | Logical modules, data domains, integrations, AI boundaries and non-functional requirements | Technical leads and coding agents |
| 09_Delivery_Roadmap_Governance_Trust_and_Compliance | Phasing, ownership, decision rights, QA, trust, risk and launch readiness | Founders, product managers, team leads |

## Working assumptions
These are the default assumptions for the initial design. Agents should surface a decision request before contradicting them.
1. The Sacred North is provisional. The product must be brand-portable. Brand name, logo, tagline, domain, company name, social links, legal footer and email identities must be configurable rather than scattered through the codebase.
2. Adi Kailash and Om Parvat are the flagship journey. The platform must also accommodate Kumaon spiritual circuits, temple hikes, private departures, cultural experiences and later expansion across the Himalaya.
3. The business sells care and operational confidence, not only inventory. Trust, truthfulness, local roots, responsiveness and disruption handling are core product features.
4. WhatsApp is a primary conversion and service channel. The website remains the authoritative source of structured information, while WhatsApp provides guided qualification and human reassurance.
5. A human owns high-stakes decisions. AI may assist with discovery, summarisation and routine guidance, but may not independently provide medical clearance, guarantee permits, guarantee route status, change refund rules, promise a room or vehicle, or interpret regulations.
6. The first launch is conversion-first, not spectacle-first. A fast mobile website, clear journey information, live-status trust, WhatsApp handoff and basic lead operations take priority over elaborate 3D experiences.
7. The experience must work in uncertain mountain conditions. Status, departures, accommodation, route changes and alternatives are dynamic. The system must represent uncertainty honestly rather than forcing binary promises.
8. The system should support an interim registered operating partner. It must be possible to disclose the legal operator for each departure and later move departures under the founders' own entity without redesigning the product.
9. The adjacent hill-mobility startup is a future shared capability, not a launch dependency. The architecture should avoid blocking eventual integration with intercity mobility, but the initial tourism website should not become a half-built mobility marketplace.
10. Prices, dates, permit rules and route conditions are content-managed. They must not be treated as permanent product constants.

## Non-negotiable experience principles

### Reverence without exploitation
The customer may genuinely feel that Shiva has called them. The brand should honour that psychology with humility. The company is a local facilitator and custodian of the earthly journey, not an authority between the devotee and God.
Preferred internal framing:
| The calling is between Shiva and the devotee. We take responsibility for the journey that follows. |
Avoid manipulative language such as guaranteed blessings, divine selection, fear-based urgency, claims that booking through the company is spiritually superior, or suggestions that a traveller is disobeying a divine call by not purchasing.

### Truth before conversion
Show real accommodation, real route limitations, actual inclusions, current verification time, operator identity, group size, expected comfort and disruption policies. The interface should make uncertainty legible.

### Mobile and low-bandwidth first
Most discovery and enquiry will happen on mobile. Core information, enquiry, payment instructions, documents and trip updates must remain usable on imperfect connections. Heavy media and 3D should be optional and progressively loaded.

### Human care at critical moments
A customer should always know who is responsible for the next step. The product should expose a named sales owner, trip coordinator or emergency contact when appropriate instead of presenting an anonymous automation wall.

### Local authority
The product should feel born in Pithoragarh and Kumaon through original photographs, local knowledge, verified vendors, field updates and culturally accurate storytelling. Generic Himalayan imagery must not substitute for route truth.

## Priority model
Use the following common priority language across all documents.
| Priority | Meaning | Release expectation |
| P0 - Launch critical | Required to acquire, qualify, reserve and safely prepare the first controlled departures | Must be complete before public launch or before the relevant operational step is enabled |
| P1 - Conversion and operations maturity | Materially improves conversion, traveller confidence or operating efficiency after the core launch works | Deliver in the first major iteration after initial validation |
| P2 - Differentiation and scale | Advanced experience, automation, intelligence or ecosystem capability | Build only after evidence, content and operations justify it |
| Deferred | Intentionally outside the current product boundary | Record but do not build without a founder decision |

## Shared product boundary

### P0 launch scope
- Mobile-first public website with clear journey and departure information
- Provisional brand system implemented through configurable tokens
- Lead capture with consent and attribution
- Official WhatsApp entry points and a structured qualification flow
- CRM or lead workspace with ownership, status and next action
- Adi Kailash and Om Parvat flagship journey page
- Basic package or service-tier comparison
- Live route and permit status page with verification timestamp and source note
- Human call scheduling and enquiry handoff
- Reservation or deposit workflow appropriate to the current operating model
- Traveller document checklist and preparation communications
- Basic departure, traveller, vendor and readiness management for operations
- Analytics for qualified leads, calls, reservations, payments and acquisition source
- Essential policy pages, operator disclosure and consent records

### P1 scope
- Self-service traveller portal
- Group and companion management
- Structured instalment, refund and payment status views
- Supplier confirmation and rooming workflows
- Automated but reviewed lifecycle messaging
- Rich content hub and destination comparison
- International enquiry and private-journey flow
- Family trip sharing, downloadable trip pack and low-connectivity support
- Review, referral and post-trip content workflows
- Stronger route-status history and subscription service

### P2 scope
- Interactive 3D route and altitude experience
- AI itinerary recommendation grounded in approved product data
- Offline trip companion or progressive web app
- Advanced vendor reliability scoring and demand forecasting
- B2B ground-handling portal
- Deep integration with the hill-mobility platform
- Multi-region and multi-brand operating system

### Explicit non-goals for the first launch
- Becoming a broad online travel agency with thousands of hotels and destinations
- A marketplace that allows unverified suppliers to self-publish trips
- Monetised rides in private non-commercial vehicles
- Fully autonomous AI sales or operations decisions
- Automatic permit issuance presented as guaranteed
- Medical diagnosis or fitness certification
- A cinematic 3D homepage that delays essential information
- Hundreds of thin, automatically generated SEO landing pages

## Shared glossary
| Term | Definition |
| Journey | A sellable travel experience or itinerary concept, such as Adi Kailash and Om Parvat |
| Package tier | A service level attached to a journey, such as Standard, Comfort or Private |
| Departure | A dated operational instance of a journey with capacity, operator, vendors and status |
| Lead | A person or group that has expressed interest but has not made a reservation |
| Qualified lead | A lead whose route, date window, group size, origin and basic fit are understood |
| Reservation | A provisional seat or group hold, often created after a refundable or conditional payment |
| Confirmed booking | A reservation that has met the defined payment, operator and departure conditions |
| Group lead | The traveller responsible for the booking and communication for a group |
| Traveller | Any individual passenger associated with a booking |
| Operating partner | The registered entity legally operating a departure when different from the consumer brand owner |
| Vendor | Hotel, homestay, vehicle owner, driver, guide, local coordinator or other supplier |
| Route status | A time-bound statement about permit, road or destination accessibility with a verification note |
| Departure readiness | The operational completeness of documents, payments, rooms, vehicles, permits, staff and contingencies |
| Verified update | Information reviewed by an authorised team member and labelled with source type and timestamp |
| Human takeover | Transfer of an automated conversation or task to an accountable team member |
| Trip companion | The traveller-facing digital experience used after reservation and during the journey |

## Decision register
The following items remain intentionally open. The product should make them easy to change.
| Decision | Current working position | Owner required | Product implication |
| Final consumer brand | The Sacred North is the working name | All three founders | Keep brand content configurable |
| Legal entity and public legal name | To be finalised | Founders and professional adviser | Separate consumer brand from legal footer and invoice identity |
| Domain | Candidate domains under review | Founder responsible for brand | Do not assume a domain in permanent links |
| Operating structure for first departures | Own registration or disclosed registered partner | Operations and compliance lead | Support operator per departure |
| Package names and final prices | Provisional tiers only | Operations and finance | CMS-managed tiers and pricing |
| Deposit and refund rules | Must be approved before payment launch | Founders and finance | Policy versioning and explicit traveller acceptance |
| Launch dates and route availability | Dynamic | Operations | Status system rather than fixed copy |
| WhatsApp provider and CRM | To be selected | Technical and sales leads | Integration boundary must remain replaceable |
| Payment provider | To be selected | Finance and technical leads | Abstract payment state from provider terminology |
| Languages at launch | English and Hindi preferred; more later | Growth and operations | Translation-ready content model |
| International traveller scope | Private and curated enquiries first | Founders | Separate qualification and service expectations |
| Mobility-platform integration | Future | Product and technical leads | Shared concepts, no launch dependency |

## Handoff method for coding agents

### Before building
- Read all documents that touch the assigned feature.
- Restate the intended user outcome, dependencies, open decisions and risks.
- Identify any policy, content or operational rule that is missing instead of inventing it.
- Propose a small release boundary and list what will remain manual.
- Confirm the source of truth for content, pricing, status and traveller communications.

### During design and implementation
- Keep the working brand configurable.
- Prefer reusable journey, departure, status and CTA patterns over destination-specific one-offs.
- Preserve manual overrides and auditability for high-stakes workflows.
- Design empty, loading, pending, unverified, cancelled, rescheduled and disrupted states explicitly.
- Make mobile and low-bandwidth behaviour part of the normal design, not a later optimisation.
- Track events needed to understand acquisition and conversion.
- Never expose sensitive traveller documents through public links.

### At handoff
Each workstream should provide:
- A concise feature summary and scope boundary
- User-flow or state-flow artefacts
- Content and data dependencies
- Roles and permissions involved
- Error, uncertainty and manual-override behaviour
- Analytics events and operational metrics
- Accessibility and mobile notes
- Test scenarios and known limitations
- Decisions requiring founder approval
- A release and rollback note appropriate to the change

## Founder and team sign-off model
Use role ownership even if the final division among the three brothers changes.
| Decision domain | Accountable role | Consulted roles |
| Brand, positioning and public claims | Brand and growth founder | All founders, operations, compliance |
| Package design, vendors and trip feasibility | Operations founder | Finance, product, local coordinators |
| Pricing, deposits, refunds and reconciliation | Finance or commercial founder | Operations, product, professional adviser |
| Product and technology | Technical product owner | Growth, operations, support |
| Route and permit status | Authorised operations owner | Field coordinator, operating partner |
| Medical and safety content | Operations owner with qualified external review | Product, content, legal adviser |
| Paid media and campaign claims | Growth owner | Finance, operations, brand |
| Launch approval | All founders | Product, operations, finance and compliance leads |

## Definition of success for the first release
The first release succeeds when a prospective traveller can discover the flagship journey, understand what is and is not confirmed, speak to the team quickly, receive a relevant proposal, reserve with clear conditions, complete required preparation, receive reliable updates and enter a departure that operations can manage without fragmented spreadsheets and personal-message chaos.
The website does not need to look like the largest travel company. It must feel like the most truthful, attentive and locally competent guide to a sacred journey.