| HANDOFF 06  /  The Sacred North (provisional working name)Admin, Operations, Vendor and Departure ManagementBack-office requirements for running controlled departures with visible readiness, supplier accountability and disruption handling |
| Defines the internal operating system for departures, traveller readiness, suppliers, route status, partner operators, communications, incidents, reconciliation and management reporting. |
| AUDIENCE | Operations leaders, trip coordinators, finance, product managers, engineers and founders |
| STATUS | Working Draft v0.1 |
| IMPORTANT | The Sacred North is a provisional working name. Treat all brand elements as replaceable configuration. |
INTERNAL HANDOFF  |  8 AUGUST 2026

## Operational product vision
The admin system should replace fragmented coordination across personal WhatsApp chats, spreadsheets, handwritten lists and memory with a shared, accountable view of every departure.
Mountain journeys will never become completely predictable. The purpose of the operating system is not to pretend uncertainty can be removed. It is to make uncertainty visible early, assign responsibility, preserve communication and support fast, truthful decisions.
| Operational north star: At any moment, the team should know which departures are at risk, which travellers are not ready, which supplier promises remain unconfirmed, who owns the issue and what the customer has been told. |

## Core operating objects
| Object | Operational meaning |
| Journey | Master itinerary and product definition |
| Service tier | Service-level configuration attached to a journey |
| Departure | Dated operational instance with capacity, operator, travellers, suppliers and status |
| Booking | Commercial relationship between customer group and departure |
| Traveller | Individual passenger requiring data, documents and readiness |
| Operating partner | Registered entity responsible for operating a departure when applicable |
| Vendor | Stay, vehicle, driver, guide, local coordinator, meal provider or other supplier |
| Allocation | Specific room, seat, vehicle, guide or service assigned to a departure or traveller |
| Route segment | Operational leg with access, time, risk and supplier dependency |
| Status update | Verified statement affecting a route, departure or traveller |
| Task | Action with owner, due date and evidence |
| Incident | Event requiring operational response, communication or follow-up |
| Financial item | Supplier payable, customer receivable, refund, credit or reconciliation record |

## Internal roles and permissions
Roles should be configurable and follow least privilege.

### Suggested roles
| Role | Primary responsibility |
| Super admin | System configuration and exceptional access; should be tightly limited |
| Founder or business owner | Cross-functional overview, approvals and escalation |
| Sales manager | Lead and commercial oversight before operational handoff |
| Journey operations manager | Departure creation, feasibility, supplier and readiness ownership |
| Trip coordinator | Specific departure and traveller communication |
| Document or permit reviewer | Traveller-document review and submission status |
| Vendor coordinator | Supplier onboarding, confirmation and issue management |
| Finance | Payments, invoices, refunds, supplier payables and reconciliation |
| Content or status publisher | Approved public content and route-status updates |
| Support or incident responder | Booking and trip support under controlled access |
| Operating partner user | Limited access to assigned departures and required traveller data |
| Vendor user, later | Restricted acknowledgement or task completion only |
| Read-only auditor | Reports and audit trail without edit rights |
No one should gain broad access simply because they are part of the family or team. Sensitive documents, finance and incidents require explicit permission.

## Operations home and management dashboard
The default internal view should prioritise exceptions and deadlines rather than decorative analytics.

### At-a-glance panels
- Departures in the next 7, 14 and 30 days
- Departures blocked or at risk
- Unverified or stale route statuses
- Travellers with critical missing documents
- Pending permit or operator submissions
- Unconfirmed hotels, rooms, vehicles or guides
- Customer balances and refunds requiring action
- Supplier payments due
- Open incidents and complaints
- Communications due today
- Capacity and waitlist overview

### Management filters
- Journey
- Departure date
- Status
- Operating partner
- Service tier
- Sales channel
- Trip coordinator
- Gateway
- Vendor
- Risk level

## Departure lifecycle
Use an explicit lifecycle so a date is not published before it is operationally meaningful.
| State | Internal meaning | Public implication |
| Draft | Under design; not sellable | Hidden or register-interest only |
| Feasibility review | Costs, route, operator and supplier assumptions under review | Not open for payment |
| Proposed | Candidate date and tier exist | May support internal demand collection |
| Waitlist open | Collecting interest under approved terms | Public waitlist, no implied confirmation |
| Conditional reservation | Approved protected reservation subject to dependencies | Conditions shown clearly |
| Open for booking | Commercial and operational thresholds met | Reservation or booking enabled |
| Minimum group pending | Bookings exist but defined threshold remains | Clearly conditional |
| Confirmed | Operator and departure conditions met | Traveller preparation proceeds |
| Preparation | Documents, suppliers, rooming and payments in progress | Booking-specific readiness updates |
| Ready to depart | Required operational gates complete | Final trip pack and movement details |
| In progress | Departure underway | Active-trip support mode |
| Completed | Operational closeout pending or complete | Post-trip experience |
| Suspended | Temporarily blocked by route, permit or other issue | Stop inappropriate payment and inform affected leads |
| Rescheduled | Moved to another date or itinerary | Customer choice and acknowledgement required |
| Cancelled | Will not operate | Refund, credit and closure workflow |
Changing a public departure state should require an authorised role and record a reason.

## Departure control centre
A departure detail view should bring commercial, traveller, supplier and risk information together.

### Summary
- Journey, tier and date range
- Gateway and itinerary version
- Internal and public status
- Operating entity or partner
- Capacity, reserved, confirmed and waitlist counts
- Revenue, receivable and supplier-cost summary at authorised level
- Operations owner and trip coordinator
- Current readiness score
- Main risks and next decision date

### Workstreams within a departure
- Travellers and manifest
- Documents and permits
- Payments and refunds
- Accommodation and rooming
- Vehicles, drivers and transport legs
- Guides and local coordinators
- Itinerary and route segments
- Communications
- Tasks and approvals
- Incidents and changes
- Supplier payables and reconciliation
- Audit history

## Departure readiness model
A readiness score should help prioritise work, but it must not conceal critical blockers behind an average percentage.

### Suggested readiness domains
| Domain | Example checks |
| Commercial | Minimum group, payment thresholds, policy acceptance, invoice owner |
| Traveller | Required details, emergency contacts and individual task completion |
| Documents and permits | Required files accepted, submission complete, outcomes tracked |
| Accommodation | Property, room count, rooming assumptions and written confirmation |
| Transport | Vehicle, permit/eligibility, driver, backup and movement plan |
| People | Trip coordinator, guide, local support and escalation contacts |
| Route | Current status, route plan, alternatives and next verification time |
| Safety | Emergency plan, first-aid responsibility, insurance process and incident contacts |
| Communication | Pre-departure briefing, customer notices and final trip pack |
| Finance | Customer balances, supplier advances, refund exposure and reserve |

### Readiness behaviour
- Show overall percentage only alongside domain status
- Allow critical blocker, warning and complete states
- Require evidence or confirmation for high-risk gates
- Preserve who completed or waived a gate
- Use due dates tied to departure date
- Escalate overdue critical items
- Do not automatically mark readiness complete from a single uploaded file or verbal note

## Traveller manifest and group management

### Manifest view
- Group and booking
- Traveller legal name and identifiers required for operations
- Contact and emergency contact
- Nationality or permit-relevant details
- Document status
- Payment or booking status summary
- Rooming group
- Pickup and return information
- Support or dietary flag visible only to relevant roles
- Consent and acknowledgement state

### Group handling
- One booking may include multiple travellers
- A departure includes multiple bookings and groups
- Group changes require capacity, rooming and financial review
- Name replacement or transfer follows approved rules
- Waitlist promotion should preserve original terms and communication
- Duplicate passenger detection should avoid accidental double allocation

### Exports and sharing
Operations may need manifests, rooming lists, permit submissions or vendor lists. Exported data should be purpose-specific, access-controlled, watermarked or tracked where appropriate, and should not contain unnecessary private information.

## Documents and permit operations

### Configurable requirements
Requirements may differ by:
- Journey and departure
- Operating partner
- Nationality
- Age or traveller category where lawfully required
- Permit authority
- Current season or rule version
Do not encode a single permanent checklist into the product.

### Reviewer workflow
- Request document or information
- Receive secure submission
- Review against approved criteria
- Accept or request correction with reason
- Record expiry or validity
- Prepare submission set
- Submit to operator or authority
- Record acknowledgement and outcome
- Notify affected traveller

### Audit and privacy
- Track access and download for sensitive documents
- Restrict bulk export
- Avoid keeping data longer than approved
- Support deletion or archival policy after the journey
- Separate customer-facing status from internal notes
- Do not allow AI to infer permit approval from document appearance

## Accommodation and rooming operations

### Vendor record
- Legal or business name
- Property name and location
- Contact people and escalation path
- Room types and count
- Seasonal availability
- Facilities and limitations
- Verified images and last inspection or verification date
- Rate agreements and tax terms
- Payment schedule
- Cancellation and substitution terms
- Service history and issues
- Emergency alternatives

### Departure allocation
- Rooms required and held
- Written confirmation or voucher
- Occupancy plan
- Traveller preferences and constraints
- Check-in dates
- Meal plan
- Supplier payment status
- Backup property
- Customer-facing release timing

### Truthfulness requirement
Marketing content, proposal and operational allocation must remain aligned. If a named property is not guaranteed until confirmation, the customer-facing language must say so. Any substitution should be recorded with reason, equivalence review and communication.

## Vehicles, drivers and movement operations

### Vendor and vehicle data
- Fleet owner or operator
- Vehicle category and registration
- Commercial eligibility and relevant document status
- Seating and luggage capacity
- Driver identity and contact
- Insurance and fitness documentation as applicable
- Route suitability
- Maintenance or issue history where available
- Backup capacity
- Rate and payment terms

### Movement plan
Each departure should define legs such as:
- Gateway pickup
- Lower-route transfers
- Upper-route vehicle change
- Local sightseeing or temple hike transfers
- Return movement
- Emergency or alternative movement
For each leg, record planned time, vehicle category, supplier, driver assignment, passenger group, luggage plan, confirmation state and fallback.

### Customer release
Driver and registration details should be released at an operationally appropriate time, not guessed early. Changes should trigger a clear update and preserve the previous assignment internally.

## Guides, coordinators and local support
- Role and scope
- Experience and language
- Journey assignment
- Availability and contact
- Training or qualification evidence where relevant
- Emergency responsibility
- Traveller feedback
- Payment terms
- Backup person
The product should distinguish a spiritual or cultural guide, trek guide, driver, local coordinator and trip manager rather than treating all as generic staff.

## Operating partner model
The product must support a departure operated by a registered partner while the consumer brand owns marketing, technology or concierge.

### Partner record
- Legal identity and public name
- Registration and validity details
- Contact and authorised users
- Contract or agreement reference
- Scope of responsibility
- Insurance and compliance documents
- Payment and revenue-share terms
- Customer contract and invoice responsibility
- Complaint, refund and incident responsibility

### Departure disclosure
Each departure should identify:
- Consumer brand
- Legal seller or contracting entity
- Operating entity
- Payment recipient
- Invoice issuer
- Customer support owner
- Emergency owner
The public website and customer documents must not imply that a partner's registration belongs to the brand owner.

## Route and status management

### Route-segment model
A journey may contain route segments with:
- Origin and destination
- Mode
- Estimated duration
- Altitude context
- Permit or access dependency
- Seasonal notes
- Known risk categories
- Current status
- Verification source and time
- Alternative route or plan
- Affected departures

### Status workflow
- Field information received
- Unverified internal note
- Reviewed by authorised owner
- Published as verified update
- Affected departures assessed
- Customer and lead communication triggered where needed
- Next verification time set
- Status expires or becomes stale visibly

### Source hierarchy
The team should define an approved source hierarchy such as official notice, district or tourism confirmation, operating partner, authorised field coordinator and supplier observation. The interface must distinguish official information from field intelligence.

## Communication operations
A single operational change may require different messages to:
- Prospective leads
- Waitlist members
- Reserved customers
- Confirmed travellers
- Sales team
- Trip coordinator
- Vendors
- Operating partner
- Family-share recipients
The system should support audience selection, message approval, channel, delivery status and acknowledgement without forcing manual copy-paste across every chat.

### Communication template structure
- Subject or message type
- Affected journey or departure
- What changed
- Impact
- Required action
- Deadline or next update time
- Options
- Contact
- Approver
Critical messages should preserve the exact approved version sent to each audience.

## Change, disruption and rescheduling

### Common change types
- Permit suspension or delay
- Road closure or weather disruption
- Departure-date change
- Itinerary or route change
- Hotel substitution
- Vehicle or driver change
- Minimum group not met
- Traveller cancellation or name change
- Supplier failure
- Medical or safety incident

### Change workflow
1. Log the issue and affected scope
2. Assign owner and severity
3. Verify facts and source
4. Assess traveller, operational and financial impact
5. Decide approved options
6. Prepare and approve communication
7. Record customer acknowledgement or choice
8. Update allocations, finance and itinerary
9. Close with evidence and lessons learned
Do not overwrite the original plan. Preserve a history of what changed and why.

## Incident management

### Incident categories
- Traveller illness or injury
- Vehicle breakdown or accident
- Missing traveller or communication loss
- Accommodation failure
- Route or weather emergency
- Supplier misconduct
- Data or privacy issue
- Payment dispute
- Behaviour or safety complaint
- Lost property

### Incident record
- Time and location
- People and departure affected
- Reporter
- Severity
- Immediate action
- External emergency or authority contact
- Responsible owner
- Customer or family communication
- Costs and insurance information
- Resolution
- Follow-up and corrective action
Sensitive incidents should have restricted access. The system should not use traveller incidents for marketing without explicit consent.

## Finance and reconciliation
The operations system need not replace accounting software, but it must align operational commitments with money.

### Customer-side visibility
- Booking value
- Payments and due amounts
- Refund or credit state
- Invoice responsibility
- Payment exceptions

### Supplier-side visibility
- Agreed cost
- Advance due and paid
- Balance due
- Invoice or receipt
- Cancellation or change charge
- Service delivered
- Dispute or deduction

### Departure economics
Authorised managers should be able to see:
- Revenue by booking
- Expected and actual supplier cost
- Acquisition allocation if available
- Refund exposure
- Contingency reserve
- Contribution estimate
- Variance and reason
No customer-facing claim should be changed because an internal supplier cost increased without an approved commercial decision.

## Vendor quality and learning
After each departure, record performance on:
- Confirmation reliability
- Pickup or service punctuality
- Accuracy against promise
- Cleanliness and condition
- Staff behaviour
- Communication
- Issue resolution
- Traveller feedback
- Cost variance
- Willingness to use again
A future vendor score may assist planning, but serious incidents and manual judgement must remain visible rather than hidden in an average.

## Reporting and management metrics

### Readiness and execution
- Departures by lifecycle state
- Critical blockers by departure
- Traveller document readiness by target date
- Supplier confirmation completion
- Late changes and substitutions
- On-time movement and pickup
- Incident rate and severity

### Service quality
- Complaints by category
- Promise-versus-delivery mismatches
- Communication delays
- Traveller satisfaction by vendor and departure
- Refund or compensation due to operational failure

### Vendor and finance
- Vendor confirmation and cancellation rate
- Cost variance
- Supplier payment ageing
- Revenue and contribution by departure
- Contingency usage

## Feature priorities
| Capability | Priority | Notes |
| Departure lifecycle and owner | P0 | Foundation for all operations |
| Traveller manifest and readiness | P0 | Required before controlled departures |
| Configurable document states | P0 | Critical operational risk |
| Operator and vendor assignments | P0 | Make responsibility visible |
| Accommodation, vehicle and guide confirmation | P0 | Can begin with structured manual entry |
| Route status and affected-departure link | P0 | Critical in mountain conditions |
| Tasks, blockers and due dates | P0 | Prevent reliance on memory |
| Booking-specific communications | P0 | Required for truthful disruption handling |
| Finance summary and refund state | P0/P1 | Must align with accounting process |
| Departure readiness score | P1 | Use domain blockers, not only percentage |
| Vendor portal or confirmations | P1/P2 | Add after supplier behaviour is understood |
| Advanced vendor scoring | P2 | Requires enough completed trips |
| Automated re-planning | Deferred | Human operational judgement remains central |

## Acceptance scenarios
The operations system is ready when:
1. A departure cannot appear confirmed internally without the defined commercial and operational conditions.
2. The operations manager can identify all critical missing documents and supplier confirmations for an upcoming departure.
3. A hotel substitution is recorded, reviewed and communicated without erasing the original promise.
4. A route-status change identifies affected leads, reservations and confirmed travellers.
5. A registered operating partner can be associated with a departure and disclosed correctly.
6. A trip coordinator can see the latest manifest, rooming, transport, contacts and customer communications in one place.
7. A payment or refund state visible to travellers matches the finance record.
8. A critical incident has a restricted record, owner, timeline and follow-up.
9. Managers can compare expected and actual supplier performance and costs after the trip.
10. Every material status, waiver, change and communication has an audit history.