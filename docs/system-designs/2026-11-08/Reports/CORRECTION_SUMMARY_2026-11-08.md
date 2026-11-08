# Adulis — correction summary, 8 November 2026

This archive contains **34 complete current designs**. **24 designs were revised** to incorporate approved post-13 October changes; **10 designs remain unchanged** from the 13 October pack. No design is delivered as a change-only fragment.

## Critical corrections locked in

- Launch Adulis surcharge remains **0 bps / amount zero**; the prototype 0.5% line is stale.
- The ordinary Account architecture is **not unresolved**: one ordinary Account can expose Buyer, authorized Seller Companion and Courier contexts; Operator remains separate.
- Initial Scene publication requires at least one eligible same-Seller available Product; zero-tag/all-unavailable publication is rejected.
- Buyer-facing visible terms are **Product** and **Scene**, while internal canonical names may remain Product Post / Scene Post.
- Courier remains a **MOBILE** mode in the system design; stale executable API/CONSOLE wording is an implementation-contract gap, not a product reversal.

## Updated designs

- ADU-ANL-01 Analytics & Attribution → v3.3 (ADU-ANL-01_Adulis_Analytics_Event_Tracking_Attribution_Complete_System_Design_v3.3.pdf)
- ADU-ARCH-PLATFORM-01 Platform Integration → v3.3 (ADU-ARCH-PLATFORM-01_Adulis_Platform_Integration_System_of_Systems_Architecture_v3.3.pdf)
- ADU-AUTH-02 Authentication & Authorization → v3.3 (ADU-AUTH-02_Adulis_Authentication_Authorization_Layer_System_Design_v3.3.pdf)
- ADU-CATINV-01 Catalogue & Inventory → v3.3 (ADU-CATINV-01_Adulis_Catalogue_Inventory_System_Design_v3.3.pdf)
- ADU-CHAT-01 Buyer-Seller Chat → v3.3 (ADU-CHAT-01_Adulis_Buyer_Seller_Chat_System_Design_v3.3.pdf)
- ADU-CHATBOT-01 Chatbot & NLU Engine → v3.3 (ADU-CHATBOT-01_Adulis_Chatbot_NLU_Engine_System_Design_v3.3.pdf)
- ADU-CONSOLE-02 Seller Console → v4.3 (ADU-CONSOLE-02_Adulis_Seller_Console_System_Design_v4.3.pdf)
- ADU-DEPLOY-01 Deployment Architecture → v3.2 (ADU-DEPLOY-01_Adulis_Deployment_Architecture_System_Design_v3.2.pdf)
- ADU-FIN-01 Payments, Payouts & Financial Evidence → v3.3 (ADU-FIN-01_Adulis_Payments_Payouts_Financial_Evidence_System_Design_v3.3.pdf)
- ADU-FUL-01 Fulfilment & Courier Assignment → v3.3 (ADU-FUL-01_Adulis_Fulfilment_Courier_Assignment_Complete_System_Design_v3.3.pdf)
- ADU-MKT-01 Market Configuration & Localization → v3.3 (ADU-MKT-01_Adulis_Market_Configuration_Localization_System_Design_v3.3.pdf)
- ADU-MOB-02 Mobile App → v4.3 (ADU-MOB-02_Adulis_Mobile_App_System_Design_v4.3.pdf)
- ADU-MOD-01 Moderation & Abuse → v3.3 (ADU-MOD-01_Adulis_Moderation_Abuse_System_Design_v3.3.pdf)
- ADU-NOTIF-01 Notifications → v3.3 (ADU-NOTIF-01_Adulis_Notifications_System_Design_v3.3.pdf)
- ADU-ORDER-01 Order Management & Checkout → v3.3 (ADU-ORDER-01_Adulis_Order_Management_Checkout_System_Design_v3.3.pdf)
- ADU-PRV-01 Privacy & Data Lifecycle → v3.3 (ADU-PRV-01_Adulis_Privacy_Retention_Deletion_Data_Lifecycle_Complete_System_Design_v3.3.pdf)
- ADU-REC-01 FYP & Recommendation Engine → v3.2 (ADU-REC-01_Adulis_FYP_Recommendation_Engine_System_Design_v3.2.pdf)
- ADU-REV-01 Reviews & Ratings → v3.3 (ADU-REV-01_Adulis_Reviews_Ratings_System_Design_v3.3.pdf)
- ADU-SCN-01 Scene Posts & Content Lifecycle → v3.2 (ADU-SCN-01_Adulis_Scene_Posts_Content_Lifecycle_Complete_System_Design_v3.2.pdf)
- ADU-SRC-01 Search & Collections → v3.2 (ADU-SRC-01_Adulis_Search_Collections_System_Design_v3.2.pdf)
- ADU-STOREFRONT-02 Seller Storefront → v4.2 (ADU-STOREFRONT-02_Adulis_Seller_Storefront_System_Design_v4.2.pdf)
- ADU-TRUST-01 Trust Ladder & Reputation → v3.3 (ADU-TRUST-01_Adulis_Trust_Ladder_Reputation_Engine_System_Design_v3.3.pdf)
- ADU-WEB-02 Company Website → v4.2 (ADU-WEB-02_Adulis_Company_Website_System_Design_v4.2.pdf)
- ADU-KB Canonical Knowledge Base → v3.3 (Adulis_Canonical_Knowledge_Base_2026-11-08_v3.3.pdf)

## Unchanged designs

- ADU-CLAIM-01 Claims, Disputes & Evidence v3.2
- ADU-CSP-01 Content Security Policy v1.1
- ADU-DPIA-01 Data Protection Impact Assessment v1.1
- ADU-EVT-01 Eventing & Background Jobs v3.2
- ADU-HND-01 Handoff Verification v3.2
- ADU-MEDIA-01 Media Management & Processing v3.1
- ADU-OBS-01 Observability & Reliability v3.2
- ADU-ONB-01 Seller Onboarding v3.2
- ADU-OPS-01F Operator Console - Founder Operations v3.1
- ADU-OPS-01S Operator Console - Staff Operations v3.1

## Open / deferred

- Final brand palette selection.
- Production Seller Stories domain/API/event/media/retention design.
- Courier MOBILE executable API/auth contract and mode-eligibility bootstrap.
- Clean generated API-client type exports.
- Human-reviewed Amharic translation before user release.
- Existing repository-health/CI debt is not silently repaired by this design pack.