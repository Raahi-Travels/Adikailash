| HANDOFF 05  /  The Sacred North (provisional working name)Traveller Booking Portal and Trip CompanionThe post-enquiry experience for reservation, group preparation, payments, updates and journey support |
| Defines the traveller-facing lifecycle after a lead converts, including reservation states, companion onboarding, document readiness, payment visibility, itinerary, route updates, family sharing and post-trip closure. |
| AUDIENCE | Product managers, UX designers, engineers, sales, operations, support and finance teams |
| STATUS | Working Draft v0.1 |
| IMPORTANT | The Sacred North is a provisional working name. Treat all brand elements as replaceable configuration. |
INTERNAL HANDOFF  |  8 AUGUST 2026

## Product role
The traveller portal should turn a fragile verbal promise into a visible, organised relationship. After a customer reserves, the experience must answer four questions at all times:
1. What is my current booking state?
2. What do I need to do next?
3. What has the company confirmed?
4. Who is responsible if I need help?
The portal is not intended to replace WhatsApp or a coordinator. It creates one reliable source of truth so that critical information is not scattered across calls, spreadsheets, personal chats and forwarded PDFs.
| Traveller promise: Your journey, people, payments, documents, updates and support should be understandable in one place. |

## Access model
The first version may use a low-friction secure access method rather than forcing every companion through a complex account-creation process. Regardless of implementation, access must be authenticated, revocable and appropriate for sensitive traveller information.

### Roles
| Role | Typical permissions |
| Group lead | View booking, manage invitations, see group readiness, coordinate payment where authorised and communicate with the team |
| Companion traveller | Complete own details, documents, acknowledgements and view relevant trip information |
| Parent or authorised family helper | Assist a traveller with consent without gaining unrelated group access |
| Journey coordinator | View and update customer-facing operational information and tasks |
| Sales owner | View commercial context and handoff status; limited post-booking changes |
| Finance owner | Manage payment and refund states, not private travel notes unless needed |
| Support or emergency role | Access relevant active-trip contacts and incident information under controlled permissions |
The group lead should not automatically see every sensitive document or private health-related note of another adult companion unless consent and business need support it.

## Booking lifecycle and language
The portal must use states that match the actual commercial and operating model.
| State | Customer meaning | Portal emphasis |
| Enquiry | No reservation exists | Return to sales or proposal |
| Reservation invited | An approved payment or action can hold priority | Conditions, expiry and policy |
| Reserved - conditional | Money or priority received, but defined conditions remain | Conditions, next update and protection options |
| Reserved - departure pending | Seat or group is held while departure confirmation is pending | Status and no false guarantee |
| Confirmed | Required conditions and payments for confirmation are met | Preparation timeline and coordinator |
| Preparation in progress | Documents, payments and supplier details are being completed | Readiness tasks |
| Ready to depart | Required traveller and operational tasks are complete | Final trip pack |
| In journey | Trip is active | Daily movement, contacts and urgent support |
| Completed | Journey ended | Feedback, documents, memories and referral |
| Rescheduled | Date or itinerary changed | Choice, acknowledgement and new plan |
| Cancelled or refunded | Booking ended | Financial status and closure record |
Avoid using "confirmed" simply because a payment was captured if permits, minimum group or operator conditions remain unresolved.

## Portal home
The booking home should be calm, task-oriented and mobile-first.

### Above-the-fold information
- Journey and departure
- Booking state in plain language
- Primary next action
- Time or date by which the action is needed
- Group readiness summary
- Payment summary
- Current route or departure notice
- Named coordinator and contact method

### Journey progress timeline
A simple timeline may include:
- Reservation
- Group details
- Documents
- Payment milestones
- Departure confirmation
- Final travel pack
- Journey underway
- Completed
The timeline should distinguish customer tasks from team verification. Uploading a document is not the same as the document being reviewed and accepted.

## Group and companion management

### Group lead experience
The group lead should be able to:
- See all invited companions and completion status
- Invite a companion through a secure link or assisted flow
- Enter basic details for a companion who needs help, subject to consent
- Identify room or family grouping preferences
- See missing tasks without seeing unnecessary sensitive data
- Share general trip information with a family group
- Request a change through a controlled support path

### Companion experience
Each companion should be able to:
- Confirm identity and contact information
- Provide required travel details
- Upload or submit required documents securely
- Review personal task status
- Acknowledge relevant policies and guidance
- View itinerary, packing and coordinator information
- Contact the team

### Data minimisation
Collect only data needed for the journey, permit, safety, payment or legal obligation. Explain why each sensitive field or document is requested. Do not use travel documents for unrelated marketing.

## Traveller profile and required information
The exact fields depend on current rules and operator requirements. The portal should support configurable requirements by journey, departure, traveller type and nationality.

### Common profile categories
- Full legal name
- Contact details
- Date of birth or age where operationally required
- Gender or other identity field only where required by a valid process
- Nationality and residence
- Government identification details where required
- Emergency contact
- Pickup and gateway information
- Rooming preference
- Food preference or allergy voluntarily disclosed and operationally needed
- Accessibility or support need voluntarily disclosed
- Insurance information when required or recommended
- Document-expiry information where relevant
The system should not infer suitability, religion or medical condition from these details.

## Document readiness
Documents are a major source of last-minute failure and should be treated as a structured workflow.

### Document states
- Not requested
- Required
- Awaiting upload
- Uploaded
- Under review
- Accepted
- Rejected or needs correction
- Expired or expiring
- Waived with authorised reason
- Submitted to operator or authority
- Permit outcome recorded

### Traveller-facing behaviour
- Explain what is required and why
- Show file or information requirements
- Show review status separately from upload status
- Provide a clear correction reason
- Avoid exposing internal notes
- Show the deadline and support contact
- Allow replacement without losing audit history
- Do not claim that document acceptance guarantees a permit

### Operations behaviour
- Requirements vary by journey and departure
- Review ownership is visible
- Sensitive files are access-controlled
- Download and sharing are auditable
- Retention and deletion follow approved policy
- Bulk manifest or operator submission can be generated later without making the customer re-enter data

## Medical and high-altitude readiness
The portal may educate and document acknowledgement, but it must not diagnose or certify fitness.

### Appropriate functions
- Explain that high-altitude travel can involve significant health risk
- Encourage consultation with a qualified medical professional
- Provide the currently approved fitness-certificate or medical-document process where applicable
- Ask the traveller to acknowledge that they have reviewed the guidance
- Allow a traveller to request a planning call
- Surface operational support needs voluntarily disclosed
- Record emergency contacts and insurance when appropriate

### Prohibited behaviour
- Automatically declaring a traveller fit or unfit
- Providing medication instructions without qualified review
- Using age as the only suitability rule
- Suggesting oxygen availability makes the trip safe for everyone
- Hiding risk to protect conversion
- Exposing health information to unrelated staff or group members

## Payments, invoices and refunds
The portal should describe the money state in plain business language independent of the payment provider.

### Payment summary
- Total approved price or proposal value
- Amount paid
- Amount due
- Next due date
- Payment purpose: reservation, deposit, instalment, balance or other approved label
- Payment state
- Invoice or receipt link
- Refund or credit state when applicable
- Policy version and acceptance record

### Payment states
- Not due
- Due
- Processing
- Paid
- Failed
- Partially paid
- Refunded
- Partially refunded
- Credited or transferred to another departure
- Disputed or under review

### Safeguards
- Do not accept payment for a departure state that policy prohibits
- Show whether a payment is refundable, conditional or non-refundable using approved language
- Preserve the original amount, date, purpose and payer
- Do not silently edit a paid proposal
- Record manual or offline payments with finance approval
- Provide a support path for failed or duplicate payments
- Keep customer-facing financial status aligned with finance records

## Itinerary and journey information
The traveller should see the exact itinerary version attached to the booking, not merely the latest marketing page.

### Itinerary modules
- Day or movement sequence
- Pickup and gateway details
- Estimated travel and rest periods
- Accommodation and occupancy assumptions
- Meals and inclusions as approved
- Altitude and practical notes
- Sacred or cultural context
- Packing or day-specific preparation
- Dynamic updates and substitutions
When the itinerary changes, the portal should show what changed, why, when and whether acknowledgement is required.

## Accommodation, rooming and transport

### Accommodation view
- Location and stay name when confirmed
- Accommodation category before final allocation
- Room or sharing plan where appropriate
- Verified images or description
- Essential facilities and limitations
- Check-in or contact information near departure
- Substitution notice when applicable

### Rooming
- Group lead can provide preferences
- Operations retains final allocation control subject to promise and policy
- Family and gender-sensitive arrangements should be handled carefully
- Avoid publicly exposing the full rooming list to all travellers

### Transport view
- Pickup point and time
- Vehicle category or type
- Driver and registration details when confirmed and appropriate to release
- Luggage expectations
- Seat or accessibility notes
- Local vehicle changes on upper route
- Live or periodic movement updates later

## Communication centre
The portal should preserve important messages even when WhatsApp remains the preferred conversation channel.

### Message types
- Action required
- Information update
- Route or departure alert
- Payment or document reminder
- Coordinator message
- Itinerary change
- Emergency or urgent notice
- Post-trip message
Each message should show sender or responsible team, time, related journey item and acknowledgement requirement where relevant.

### Channel behaviour
- Critical updates may be delivered through more than one channel
- The portal is the durable record
- WhatsApp is the conversational and alert channel
- Email may serve international or document-heavy communication
- SMS can be a fallback for essential short alerts
- Duplicate notifications should be coordinated to avoid panic

## Live status and departure updates
A booked traveller needs more specific information than a public visitor.

### Public versus booking-specific status
Public: Broad permit and route state, last verified time and general impact.
Booking-specific: Whether the traveller's departure is proceeding, pending, moved, cancelled or awaiting a decision; what action is required; next update time; available choices.

### Update structure
- Status label
- What changed
- What is known
- What remains unknown
- Impact on this booking
- Next update time
- Available actions
- Named contact
Do not rely on a generic public banner for an affected customer.

## Family sharing
A family member who is not travelling may need reassurance without seeing sensitive data.
P1 capability may provide a controlled share view with:
- Journey and date
- Broad itinerary
- Coordinator contact
- Daily movement or check-in summary when offered
- Emergency contact
- Important route notice
Exclude identity documents, payment details, private notes and sensitive traveller information.

## During-trip companion
The active-trip experience should work under low connectivity.

### P0 or operational minimum
- Downloadable or cached itinerary
- Named coordinator and emergency numbers
- Pickup and next-movement details
- Hotel or stay information
- Essential packing and day notes
- Route or schedule alerts
- Incident or help request path

### P1/P2 enhancements
- Offline-first progressive web experience
- Family journey sharing
- Daily check-in or traveller pulse
- Driver or vehicle live location where lawful and reliable
- Local audio or cultural guide
- Photo and memory collection
- Translation assistance
- Optional prayer, reflection or journaling space without forced religious content
The trip companion should not encourage phone use at moments where attention, safety or reverence matter.

## Help, incidents and complaints
The portal must distinguish normal support from urgent help.

### Support categories
- General preparation question
- Document issue
- Payment issue
- Pickup or transport issue
- Stay or room issue
- Health or altitude concern
- Lost item
- Safety concern
- Complaint
- Emergency
Urgent categories should display immediate instructions and the correct human contact. The portal should not become a substitute for local emergency services or qualified medical assistance.

## Post-trip experience

### Immediate closure
- Welcome-back message
- Confirmation that the booking is completed
- Access to final invoice, documents or trip pack where appropriate
- Clear path for unresolved issues
- Optional photo or memory sharing

### Feedback
Collect structured feedback on:
- Sales promise accuracy
- Preparation
- Pickup and transport
- Accommodation
- coordinator support
- Route communication
- Spiritual and cultural experience
- Overall recommendation
Resolve material complaints before requesting a public review.

### Advocacy
After a positive experience:
- Ask for a verified review with consent
- Offer a referral link or code if the business adopts one
- Invite traveller stories or images with usage permission
- Suggest relevant future journeys without immediately turning gratitude into aggressive sales

## International experience
International travellers may need additional portal modules:
- Passport and nationality-specific document guidance
- International payment and invoice context
- Arrival airport, hotel and gateway transfer plan
- Time-zone-aware communications
- Cultural orientation and terminology
- Travel insurance record
- Local SIM, connectivity and emergency guidance
- Private guide or translation support
- Pre- and post-journey extension itinerary

## Low-connectivity and resilience requirements
- Core itinerary and contacts available as a downloadable trip pack
- Essential text visible without high-resolution media
- Upload flows recover gracefully after interruption
- Message status should distinguish queued, sent and received when possible
- Avoid requiring repeated large-document uploads
- Provide SMS or phone fallback for critical updates
- Time-sensitive information should not exist only inside a heavy map or video

## Portal feature priorities
| Capability | Priority | Notes |
| Booking state and next action | P0 | Core trust after payment |
| Group lead and companion records | P0 | Essential for family and group travel |
| Configurable document checklist | P0 | Prevents last-minute failures |
| Payment and invoice summary | P0 | Must match finance truth |
| Named coordinator and support path | P0 | Human accountability |
| Booking-specific departure updates | P0 | Essential in uncertain conditions |
| Downloadable itinerary and trip pack | P0/P1 | Low-connectivity resilience |
| Secure self-service document upload | P1 if manual P0 fallback exists | Avoid insecure chat files |
| Rooming and transport confirmation view | P1 | Builds confidence near departure |
| Family sharing | P1 | Strong reassurance feature |
| Offline-first trip companion | P2 | Build after field testing |
| Live vehicle tracking | P2 | Only when reliable and lawful |
| Personal journal or media gallery | P2 | Emotional differentiator, not operational core |

## Acceptance scenarios
The traveller experience is ready when:
1. A customer who paid a conditional reservation can see exactly why it is conditional and what happens next.
2. A group lead can invite companions and see completion without viewing unnecessary sensitive data.
3. A traveller can upload a required document, see that it is under review and receive a clear correction request.
4. The portal does not label a document as approved merely because it was uploaded.
5. Payments, instalments and refunds match finance records and approved policy language.
6. The booking retains the itinerary and proposal version the customer accepted.
7. A departure update explains impact, next update time and available choices.
8. A traveller can access itinerary and emergency contacts when rich media or network is unavailable.
9. An active-trip support request reaches the correct human path instead of entering a sales bot.
10. A completed traveller can give structured feedback, resolve a problem and only then be invited to review or refer.