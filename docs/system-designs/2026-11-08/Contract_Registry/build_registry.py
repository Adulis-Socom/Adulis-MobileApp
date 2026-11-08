"""Rebuild the complete current design registry; no runtime/provider approval implied."""
from pathlib import Path
import json,os,re,copy
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'Contract_Registry'
source=os.environ.get('ADULIS_CONTRACT_SOURCE')
D=json.loads(Path(source).read_text()) if source else {d['key']:d for p in (ROOT/'Editable_Sources').glob('*.json') for d in [json.loads(p.read_text())]}
def st():return {'type':'string','minLength':1}
def integer():return {'type':'integer','minimum':0}
def optional(t):return {'anyOf':[t,{'type':'null'}]}
def obj(props,required):return {'type':'object','properties':props,'required':required,'additionalProperties':False}
FIELDS={
 'account':(['account_id'],{'account_id':st(),'deletion_request_id':st(),'effective_at':st()}),
 'session':(['ordinary_account_id','session_ref'],{'ordinary_account_id':st(),'session_ref':st(),'revoked_at':st()}),
 'seller':(['seller_id'],{'seller_id':st(),'policy_version':st(),'evidence_ref':st(),'status':st(),'previous_status':st(),'readiness_revision':integer(),'social_connection_id':st()}),
 'catalogue':(['seller_id','product_id'],{'seller_id':st(),'product_id':st(),'variant_id':st(),'product_post_id':st(),'published_revision':integer(),'catalogue_revision':integer()}),
 'inventory':(['seller_id','product_id','stock_revision'],{'seller_id':st(),'product_id':st(),'variant_id':st(),'stock_revision':integer(),'stock_event_id':st(),'confirmed_at':st(),'projection_revision':integer(),'availability_bucket':st()}),
 'scene':(['seller_id','scene_post_id','published_revision'],{'seller_id':st(),'scene_post_id':st(),'published_revision':integer(),'previous_visibility':{'enum':['PUBLIC','PRIVATE']},'current_visibility':{'enum':['PUBLIC','PRIVATE']},'reason':st()}),
 'checkout':(['order_id','attempt_id','attempt_generation','allocation_id'],{'order_id':st(),'attempt_id':st(),'attempt_generation':integer(),'allocation_id':st(),'allocation_revision':integer(),'release_decision_id':st(),'release_evidence_ref':st(),'release_effect_id':st()}),
 'payment':(['order_id','attempt_id'],{'order_id':st(),'attempt_id':st(),'attempt_generation':integer(),'charge_id':st(),'verification_ref':st(),'amount_minor':integer(),'currency':st(),'verified_at':st(),'failure_evidence_ref':st()}),
 'order':(['order_id','seller_id','buyer_account_id'],{'order_id':st(),'seller_id':st(),'buyer_account_id':st(),'order_revision':integer(),'paid_at':st(),'completed_at':st(),'final_handoff_id':st()}),
 'handoff':(['handoff_id','order_id','stage'],{'handoff_id':st(),'order_id':st(),'stage':{'enum':['PICKUP','DELIVERY']},'fulfilment_mode':st(),'verification_method':{'enum':['QR','OTP','MANUAL']},'recipient_class':{'enum':['BUYER','DELEGATE','COURIER']},'generation':integer(),'presenter_courier_assignment_id':optional(st()),'recipient_courier_assignment_id':optional(st()),'verified_at':st(),'authorization_id':st(),'credential_ref':st(),'failure_category':st(),'case_ref':st(),'transport_result_ref':st()}),
 'fulfilment':(['seller_id','order_id'],{'seller_id':st(),'order_id':st(),'assignment_id':st(),'courier_account_id':st(),'request_id':st(),'offer_id':st(),'relationship_id':st(),'terms_version':st(),'reason':st(),'delivery_revision':integer()}),
 'courier':(['seller_id','courier_account_id'],{'seller_id':st(),'courier_account_id':st(),'relationship_id':st(),'terms_version':st(),'policy_version':st()}),
 'location':(['order_id','handoff_id','stage','checkpoint_ref'],{'order_id':st(),'handoff_id':st(),'stage':{'enum':['PICKUP','DELIVERY']},'checkpoint_ref':st(),'captured_at':st()}),
 'claim':(['claim_id','order_id','seller_id'],{'claim_id':st(),'order_id':st(),'seller_id':st(),'order_line_id':optional(st()),'incident_id':st(),'evidence_ref':st(),'previous_state':st(),'current_state':st(),'decision_id':st(),'decision_version':integer(),'supersedes_decision_id':optional(st()),'correction_ref':st(),'seller_fault':{'type':'boolean'},'severity':optional(st()),'remedy_responsibility':st(),'remedy_status':{'enum':['REQUESTED','PENDING','COMPLETED','REFUSED','OVERDUE',None]},'amount_minor':integer(),'currency':st(),'deadline':optional(st()),'finance_completion_ref':st(),'verified_completion_at':st(),'resolution_classification':st(),'policy_version':st()}),
 'refund':(['order_id','refund_id','status'],{'order_id':st(),'refund_id':st(),'status':st(),'amount_minor':integer(),'currency':st(),'verified_completion_ref':st(),'verified_at':st(),'obligation_ref':st()}),
 'review':(['order_id','seller_id','buyer_account_id'],{'order_id':st(),'seller_id':st(),'buyer_account_id':st(),'review_id':st(),'grant_id':st(),'previous_state':{'enum':['UNAVAILABLE','AVAILABLE','CONSUMED','REVOKED']},'current_state':{'enum':['UNAVAILABLE','AVAILABLE','CONSUMED','REVOKED']},'previous_eligibility_basis':{'enum':['FINAL_HANDOFF','VERIFIED_ORDER_FAILURE',None]},'eligibility_basis':{'enum':['FINAL_HANDOFF','VERIFIED_ORDER_FAILURE',None]},'eligibility_revision':integer(),'source_ref':st(),'source_version':integer(),'safe_remedy_status':st(),'final_handoff_id':optional(st())}),
 'trust':(['seller_id','previous_level','current_level','policy_version'],{'seller_id':st(),'previous_level':{'enum':['NEW','REBUILDING','ESTABLISHED','TRUSTED']},'current_level':{'enum':['NEW','REBUILDING','ESTABLISHED','TRUSTED']},'policy_version':st(),'evaluation_ref':st(),'decision_ref':st()}),
 'moderation':(['enforcement_ref','resource_type','resource_ref','enforcement_revision'],{'enforcement_ref':st(),'resource_type':st(),'resource_ref':st(),'enforcement_revision':integer(),'previous_state':st(),'current_state':st(),'reason_category':st(),'policy_version':st()}),
 'collection':(['collection_id','buyer_account_id','item_type','item_ref'],{'collection_id':st(),'buyer_account_id':st(),'item_type':{'enum':['PRODUCT_POST','SCENE_POST']},'item_ref':st(),'membership_revision':integer()}),
 'notification':(['notification_id','recipient_type','recipient_ref'],{'notification_id':st(),'recipient_type':{'enum':['ORDINARY_ACCOUNT','OPERATOR_ACCOUNT']},'recipient_ref':st(),'template_key':st(),'delivery_ref':st(),'delivery_status':st(),'occurred_at':st()}),
 'media':(['asset_id','purpose','owner_ref'],{'asset_id':st(),'purpose':st(),'owner_ref':st(),'technical_revision':integer(),'processing_version':st(),'failure_category':st()}),
 'privacy':(['request_id','subject_type','subject_ref'],{'request_id':st(),'subject_type':{'enum':['ORDINARY_ACCOUNT','SELLER','COURIER_RELATIONSHIP','OPERATOR_ACCOUNT']},'subject_ref':st(),'policy_version':st(),'state':st(),'task_ref':st(),'domain_name':st(),'action':st(),'proof_ref':st(),'hold_ref':st(),'reason_code':st(),'authority_ref':st(),'incident_ref':st(),'controller_awareness_at':st(),'deadline':optional(st()),'assessment_ref':st()}),
 'chatbot':(['seller_id'],{'seller_id':st(),'knowledge_version_id':st(),'intent_version_id':st(),'template_version_id':st(),'feedback_ref':st(),'escalation_ref':st(),'conversation_ref':st(),'bot_turn_ref':st(),'configuration_revision':integer(),'locale':st(),'status':st()}),
 'market':(['market_id','config_version'],{'market_id':st(),'config_version':st(),'previous_status':st(),'current_status':st(),'locale_pack_version':st(),'provider_routing_version':st()})
}
ROWS='''account.created|Accounts|AUTH §123|account|Notifications,Analytics|Committed ordinary Account creation, no fabricated Market ownership
account.deletion_requested|Account Lifecycle|AUTH §52/140|account|Auth,Privacy|Authenticated lifecycle request, not completion
account.deleted|Account Lifecycle|WEB §39; AUTH §140|account|Privacy,Auth,Recommendation|Completed approved lifecycle fact, no website authority
session.revoked|Auth|AUTH §38/118/123|session|Auth,Security|Committed ordinary session revocation, not Operator session takeover
seller.created|Seller|ONB §141|seller|Onboarding,Notifications,Analytics|Atomic Seller and OWNER relationship creation
seller.eligibility_changed|Seller Eligibility|EVT §35; ONB §141|seller|Content,Search,Recommendation,Storefront,Trust|Committed eligibility transition, consumers re-read current gates
seller.social_verification_changed|Onboarding|EVT §35; ONB §141|seller|Seller Eligibility,Audit|Committed social-control evidence state, no API approval inferred
seller.social_connection.verified|Onboarding|ONB §141|seller|Seller Eligibility,Audit|Recorded supported social control, no video permission implied
seller.social_connection.revoked|Onboarding|ONB §141|seller|Seller Eligibility,Media,Audit|Current social-control revocation
seller.eligibility.evaluated|Seller Eligibility|ONB §141|seller|Onboarding,Audit|Current eligibility evaluation observation
seller.eligibility.satisfied|Seller Eligibility|ONB §141|seller|Onboarding,Audit|Satisfied evaluation, publication still rechecks owners
seller.readiness.changed|Onboarding|ONB §141|seller|Seller Console,Notifications|Readiness observation, not cached publication permission
seller.onboarding.completed|Onboarding|ONB §141|seller|Seller Console,Notifications,Analytics|Completed legal current setup, external permissions independently gated
product.created|Catalogue|CATINV §93|catalogue|Search,Storefront,Analytics|Product aggregate creation
product.updated|Catalogue|CATINV §93|catalogue|Search,Storefront,Analytics|Product aggregate revision
product.published|Catalogue|CATINV §93|catalogue|Search,Storefront,Content|Product aggregate publication, not Product Post alias
product.withdrawn|Catalogue|CATINV §93|catalogue|Search,Storefront,Content|Product withdrawal, immutable purchased snapshots remain
variant.updated|Catalogue|CATINV §93|catalogue|Checkout,Search,Storefront|Variant revision, current commerce revalidation
product_post.updated|Catalogue|CATINV §93|catalogue|Content,Search,Storefront,Recommendation|Product Post revision
product_post.published|Catalogue|EVT §35; CATINV §93|catalogue|Content,Search,Storefront,Analytics|Current Product Post publication
product_post.unpublished|Catalogue|EVT §35; CATINV §93|catalogue|Content,Search,Storefront,Recommendation|Current Product Post unpublication
inventory.changed|Inventory|CATINV §94|inventory|Content,Checkout,Search,Storefront,Recommendation|Committed stock revision, one entry only
inventory.stock_confirmed|Inventory|CATINV §94|inventory|Content,Search,Storefront,Analytics|Owner stock confirmation evidence, distinct from a general stock change
inventory.public_stock_projection_changed|Inventory|CATINV §94|inventory|Search,Storefront,Recommendation|Derived public availability revision, never authoritative stock/eligibility
scene_post.published|Content|SCN §44|scene|Search,Recommendation,Storefront,Media,Analytics|Published same-Seller eligible revision
scene_post.revised|Content|EVT §35; SCN §44|scene|Search,Recommendation,Storefront|Published Scene revision updated
scene_post.visibility_changed|Content|SCN §44|scene|Search,Recommendation,Storefront,Collections,Notifications,Analytics|Committed PUBLIC/PRIVATE transition with independent current gates
scene_post.archived|Content|EVT §35; SCN §44|scene|Search,Recommendation,Storefront,Collections|Independent archive, not automatic zero-stock private transition
scene_post.deleted|Content|EVT §35; SCN §44|scene|Search,Recommendation,Storefront,Collections,Media|Logical deletion, privacy/holds govern physical purge
checkout.allocation_created|Checkout/Orders|EVT §35; ORDER §35|checkout|Inventory,Analytics|Current attempt allocation transition, owners retain transaction boundary
checkout.allocation_released|Checkout/Orders|EVT §35; ORDER §52|checkout|Inventory,Analytics|Committed release with authoritative proof or fenced uninitiated dispatch
payment.attempt_created|Finance|FIN §17; EVT §35|payment|Checkout,Analytics|Durable attempt identity, no payment success inferred
payment.verified|Finance|FIN §15/16; EVT §35|payment|Orders,Notifications,Analytics,Reviews,Trust|Preserved server-verified charge, operational PAID remains separately gated
payment.failed|Finance|EVT §35; FIN §17|payment|Orders,Notifications|Recorded provider result, not independent allocation release authority
refund.status_changed|Finance|TRUST §66; EVT §7|refund|Claims,Reviews,Trust,Notifications,Analytics|Truthful obligation/provider status, completion requires verified evidence
order.paid|Orders|ORDER §53; EVT §35|order|Fulfilment,Notifications,Analytics|Stock plus operational PAID/history/outbox joint commit
order.ready|Orders|ORDER §90; EVT §35|order|Fulfilment,Notifications|Current paid preparation readiness, assignment not prerequisite
order.completed|Orders|ORDER §102; EVT §35|order|Trust,Notifications,Analytics|Canonical final completion, no independent Review Grant
handoff.created|Handoff|HND §41|handoff|Orders,Analytics|Current stage created
handoff.delegate_created|Handoff|HND §41|handoff|Handoff,Notifications,Audit|Current narrow receipt authorization created
handoff.delegate_revoked|Handoff|HND §41|handoff|Handoff,Notifications,Audit|Authorization revoked, old credential generations remain invalid
handoff.qr_issued|Handoff|HND §41|handoff|Audit,Observability|Current purpose-bound QR issued, no secret payload
handoff.otp_requested|Handoff|HND §41|handoff|Audit,Observability|Recipient-directed OTP requested, not sent or verified
handoff.otp_sent|Handoff|HND §41|handoff|Audit,Observability|Protected adapter acceptance recorded, not receipt or ordinary notification alias
handoff.verification_failed|Handoff|HND §41|handoff|Claims,Audit,Observability|Safe failure category, not completed receipt
handoff.manual_review_requested|Handoff|HND §41|handoff|Operations,Audit|Governed recovery case requested, not verification approved
handoff.verified|Handoff|HND §41|handoff|Fulfilment,Orders,Reviews,Claims,Trust,Notifications,Analytics|Immutable accepted stage, DELIVERY receipt consumers explicitly filtered
handoff.revoked|Handoff|HND §41|handoff|Fulfilment,Orders,Notifications,Audit|Current stage authority revoked, preserve evidence
courier.relationship.approved|Fulfilment|FUL §57|courier|Notifications,Courier UI,Audit|Standing Seller-Courier relationship approved, not assignment
courier.terms.updated|Fulfilment|FUL §57|courier|Notifications,Seller Console,Courier UI|Relationship terms revision, paid compensation history immutable
delivery.request.created|Fulfilment|FUL §57|fulfilment|Notifications,Analytics|Paid Ready gated request creation
delivery.offer.accepted|Fulfilment|FUL §57|fulfilment|Seller Console,Notifications,Audit|Offer accepted, assignment/capacity commit remains atomic
delivery.assigned|Fulfilment|FUL §57|fulfilment|Seller Console,Courier UI,Notifications|Committed winning assignment and capacity
delivery.started|Fulfilment|FUL §57|fulfilment|Notifications,Analytics|Current custody delivery started, no final receipt
delivery.completed|Fulfilment|FUL §57|fulfilment|Notifications,Analytics,Trust|Delivery completion from accepted final evidence
delivery.cancelled|Fulfilment|FUL §57|fulfilment|Notifications,Claims,Trust|Cancelled assignment/delivery with current custody safeguards
location.pickup.captured|Fulfilment|FUL §57|location|Claims,Audit|Optional foreground PICKUP checkpoint reference, no coordinates in event
location.delivery.captured|Fulfilment|FUL §57|location|Claims,Audit|Optional foreground DELIVERY checkpoint reference, not receipt proof
claim.opened|Claims|CLAIM §89|claim|Notifications,Analytics|Committed Claim allegation, not finding
claim.evidence_attached|Claims|CLAIM §89|claim|Claims workflow,Notifications,Audit|Opaque authorized evidence manifest reference
claim.evidence_requested|Claims|CLAIM §89|claim|Notifications,Claims workflow|Bounded evidence request, not public evidence body
claim.state_changed|Claims|CLAIM §89|claim|Notifications,Analytics|Committed Claim workflow state
claim.decision_recorded|Claims|CLAIM §89|claim|Reviews,Trust,Notifications,Analytics,Finance|Versioned adjudication, not reimbursement
claim.decision_corrected|Claims|CLAIM §89|claim|Reviews,Trust,Notifications,Analytics,Finance|Superseding decision/correction lineage, current owners repair derived effects
claim.remedy_requested|Claims|CLAIM §89|claim|Finance,Notifications,Analytics|Seller-funded obligation/request, not completed money
claim.remedy_completed|Claims|CLAIM §89|claim|Reviews,Trust,Notifications,Analytics|Verified Finance reimbursement proof, distinct from adjudication
claim.resolved|Claims|CLAIM §89|claim|Notifications,Analytics|Resolved adjudication; truthful outstanding remedy remains explicit
review.eligibility_changed|Reviews|REV §29|review|Notifications,Analytics,Trust|Committed unique Buyer/Order eligibility basis/state change, no replay emission
review.published|Reviews|REV §29; EVT §35|review|Ratings,Trust,Recommendation,Analytics|Committed basis-aware feedback, received Product quality separate
trust.level_changed|Trust|TRUST §66|trust|Search,Recommendation,Storefront,Notifications|Committed approved policy result, no safety authority or guessed G04 values
moderation.enforcement_changed|Moderation|MOD §49|moderation|Content,Catalogue,Media,Auth,Trust,Search,Recommendation,Storefront,Notifications|Committed independent safety enforcement/reversal
collection.item_added|Collections|SRC §17; EVT §35|collection|Analytics,Recommendation|Accepted typed private membership, no publication permission
collection.item_removed|Collections|EVT §7; SRC §17|collection|Analytics,Recommendation|Canonical private membership removal
notification.created|Notifications|NOTIF §6; EVT §35|notification|Notification delivery|Ordinary Account/Operator recipient notice, not guest intent
notification.delivery_recorded|Notifications|EVT §7; NOTIF §6|notification|Audit,Analytics|Ordinary notice transport result, not read or business completion
media.image_uploaded|Media|EVT §35; MEDIA §9|media|Media processing|Technical accepted scoped image ingest
media.image_ready|Media|EVT §35; MEDIA §9|media|Catalogue,Content|Technical image readiness, no publication authority
media.image_failed|Media|EVT §7; MEDIA §9|media|Media workflow,Notifications|Technical image failure, current owner state retained
privacy.lifecycle_requested|Privacy|PRV §59|privacy|Auth,Privacy tasks|Typed purpose-bound request
privacy.lifecycle_confirmed|Privacy|PRV §59|privacy|Privacy tasks,Notifications|Confirmed request authority, not physical deletion completed
privacy.lifecycle_blocked|Privacy|PRV §59|privacy|Notifications,Audit|Current lawful/operational blocker
privacy.lifecycle_processing_started|Privacy|PRV §59|privacy|Privacy tasks,Audit|Durable task processing started
privacy.domain_task_completed|Privacy|PRV §59|privacy|Privacy tasks,Audit|Owner task proof recorded
privacy.hold_created|Privacy|PRV §59|privacy|Held domain owners,Audit|Exact lawful hold scope/authority, no broad default hold
privacy.hold_released|Privacy|PRV §59|privacy|Held domain owners,Audit|Hold released, current purge fences still rechecked
privacy.lifecycle_completed|Privacy|PRV §59|privacy|Auth,Notifications,Audit|Verified lifecycle completion proof, no invented legal approval
privacy.export_ready|Privacy|PRV §59|privacy|Notifications,Audit|Authorized export ready, never URL or contents in payload
privacy.incident_awareness_recorded|Privacy|PRV §59|privacy|Privacy workflow,Observability|Immutable awareness/deadline reference, restricted incident access
privacy.incident_assessment_updated|Privacy|PRV §59|privacy|Privacy workflow,Observability|Recorded legal/security assessment, no sign-off fabricated
chatbot.knowledge_version_published|Chatbot|CHATBOT §73|chatbot|Chatbot runtime,Audit|Versioned approved knowledge publication
chatbot.localization_completeness_changed|Chatbot|CHATBOT §73|chatbot|Chatbot runtime,Seller Console|Coverage observation, no unsupported-language inference
chatbot.feedback_submitted|Chatbot|CHATBOT §73|chatbot|Chatbot workflow,Audit|Private feedback reference
chatbot.feedback_triaged|Chatbot|CHATBOT §73|chatbot|Chatbot workflow,Audit|Recorded triage, no broad feedback body
chatbot.intent_version_published|Chatbot|CHATBOT §73|chatbot|Chatbot runtime,Audit|Approved intent version publication
chatbot.template_version_published|Chatbot|CHATBOT §73|chatbot|Chatbot runtime,Audit|Approved deterministic template version
chatbot.kill_switch_changed|Chatbot|CHATBOT §73|chatbot|Chatbot runtime,Seller Console|Current automation switch, any-language human text still accepted
chatbot.escalation_created|Chatbot|CHATBOT §73|chatbot|Chat,Notifications|Waiting-human escalation reference, no immediate response promise
chatbot.bot_turn_completed|Chatbot|CHATBOT §73|chatbot|Chat,Analytics|Committed supported automation turn, no money/receipt authority
market.config_published|Market|MKT §105|market|Activated domain readers,Audit|Versioned owner configuration, never external permission
market.activation_changed|Market|MKT §105|market|Activated domain readers,Audit|Current activation scope, G01-G04 evidence still gates features
market.locale_pack_changed|Market|MKT §105|market|Surface localization,Chatbot|Published approved locale version
market.provider_routing_changed|Market|MKT §105|market|Finance,Deployment|Published routing policy, not approved provider capability'''
EXTRA_REQUIRED={
 'product_post.updated':['product_post_id'],'product_post.published':['product_post_id'],'product_post.unpublished':['product_post_id'],'variant.updated':['variant_id'],
 'inventory.stock_confirmed':['confirmed_at'],'inventory.public_stock_projection_changed':['projection_revision'],
 'scene_post.visibility_changed':['previous_visibility','current_visibility','reason'],
 'checkout.allocation_released':['allocation_revision','release_decision_id','release_evidence_ref','release_effect_id'],
 'payment.verified':['charge_id','verification_ref','amount_minor','currency','verified_at'],
 'order.completed':['final_handoff_id','completed_at'],
 'handoff.verified':['fulfilment_mode','verification_method','recipient_class','generation','verified_at'],
 'handoff.delegate_created':['authorization_id','generation'],'handoff.delegate_revoked':['authorization_id','generation'],
 'handoff.otp_sent':['transport_result_ref'],'handoff.verification_failed':['failure_category'],
 'delivery.assigned':['assignment_id','courier_account_id'],'delivery.offer.accepted':['offer_id'],
 'claim.decision_recorded':['incident_id','decision_id','decision_version','seller_fault','severity','remedy_status','resolution_classification'],
 'claim.decision_corrected':['incident_id','decision_id','decision_version','supersedes_decision_id','correction_ref','seller_fault','severity','remedy_status','resolution_classification'],
 'claim.remedy_requested':['incident_id','decision_id','decision_version','remedy_status','amount_minor','currency'],
 'claim.remedy_completed':['incident_id','decision_id','decision_version','remedy_status','finance_completion_ref','verified_completion_at'],
 'claim.resolved':['resolution_classification','remedy_status'],
 'review.eligibility_changed':['previous_state','current_state','previous_eligibility_basis','eligibility_basis','eligibility_revision','source_ref','source_version'],
 'review.published':['review_id'],
 'notification.delivery_recorded':['delivery_ref','delivery_status']
}
SCHEMAS={};ENTRIES=[]
for line in ROWS.splitlines():
 name,owner,refs,fam,cs,meaning=line.split('|');required,fields=FIELDS[fam];schema=obj(copy.deepcopy(fields),list(dict.fromkeys(required+EXTRA_REQUIRED.get(name,[]))))
 if name=='claim.remedy_requested':schema['properties']['remedy_status']={'const':'REQUESTED'}
 if name=='claim.remedy_completed':schema['properties']['remedy_status']={'const':'COMPLETED'}
 if name=='claim.decision_corrected':schema['properties']['supersedes_decision_id']=st()
 if name.startswith('location.'):
  schema['properties']['stage']={'const':'PICKUP'if'.pickup.'in name else 'DELIVERY'}
 ref=name.replace('.','__')+'__v1';SCHEMAS[ref]=schema
 consumers=[{'consumer':c,'mode':'current_owner_recheck','effect_key':'consumer + logical_effect_id','revision_filter':'lock/re-read current owner revision; no stale restoration'}for c in cs.split(',')]
 if name=='handoff.verified':
  consumers=[{'consumer':'FUL_PICKUP','stage':'PICKUP','mode':'custody_only','effect_key':'consumer + logical_effect_id'},{'consumer':'FUL_DELIVERY','stage':'DELIVERY','mode':'accepted_final_receipt','effect_key':'consumer + logical_effect_id'},{'consumer':'ORDER_DELIVERY','stage':'DELIVERY','mode':'current_owner_final_completion','effect_key':'consumer + logical_effect_id'},{'consumer':'REV_FINAL_DELIVERY','stage':'DELIVERY','mode':'qualifying_final_receipt; current Buyer/Order/payment/received evidence','effect_key':'consumer + logical_effect_id'},{'consumer':'TRUST_FINAL_RECEIPT','stage':'DELIVERY','mode':'approved current policy; favourable cap only','effect_key':'consumer + logical_effect_id'},{'consumer':'CLAIMS_EVIDENCE','mode':'both stages; immutable evidence only','effect_key':'consumer + logical_effect_id'},{'consumer':'NOTIF_STAGE','mode':'stage-safe milestones; no secrets','effect_key':'consumer + logical_effect_id'},{'consumer':'ANL_STAGE','mode':'stage-distinguished measurement','effect_key':'consumer + logical_effect_id'}]
 allowed=['ORDINARY_ACCOUNT','OPERATOR_ACCOUNT','SYSTEM']
 if name in ['payment.verified','payment.failed','refund.status_changed']:allowed=['SYSTEM']
 scopes=['GLOBAL'] if fam in ['account','session']else ['GLOBAL','MARKET']if fam=='privacy'else ['MARKET']
 refs=refs.split('; ')
 ENTRIES.append({'event_type':name,'event_version':1,'owner':owner,'producer_refs':refs,'meaning':meaning,'payload_schema_ref':'event_payload_schemas.json#/$defs/'+ref,'allowed_actor_types':allowed,'allowed_scopes':scopes,'producer_authority':'Authenticated owning application service; caller actor shape is not producer authority. Current owner authorization required.','aggregate_ordering':'aggregate_revision is owner revision; consumers re-read current revision/decision and never regress it.','logical_effect_identity':'Owner-assigned logical_effect_id stored with business mutation/outbox; per-consumer PostgreSQL unique effect survives queue removal.','consumers':consumers,'privacy':'Opaque authorized references only; no phone/address/OTP/QR token/coordinates/private body/provider secrets/export URL.','release_status':'CURRENT DESIGN CONTRACT; no deployed version or provider approval claimed.'})
ACTOR={'oneOf':[
 obj({'actor_type':{'const':'ANONYMOUS_PUBLIC'},'anonymous_ref':st()},['actor_type','anonymous_ref']),
 obj({'actor_type':{'const':'ORDINARY_ACCOUNT'},'ordinary_account_id':st(),'seller_context_id':st()},['actor_type','ordinary_account_id']),
 obj({'actor_type':{'const':'OPERATOR_ACCOUNT'},'operator_account_id':st(),'seller_context_id':st()},['actor_type','operator_account_id']),
 obj({'actor_type':{'const':'SYSTEM'},'trusted_service_ref':st()},['actor_type','trusted_service_ref'])]}
envelope=obj({'event_id':st(),'event_type':st(),'event_version':{'type':'integer','minimum':1},'occurred_at':{'type':'string','format':'date-time'},'aggregate_type':st(),'aggregate_id':st(),'aggregate_revision':integer(),'logical_effect_id':st(),'actor':ACTOR,'request_id':st(),'correlation_id':st(),'causation_id':st(),'policy_version':st(),'scope':{'enum':['GLOBAL','MARKET']},'market_id':st(),'originating_market_id':st(),'payload':{'type':'object'}},['event_id','event_type','event_version','occurred_at','aggregate_type','aggregate_id','aggregate_revision','logical_effect_id','actor','correlation_id','scope','payload'])
delegate=obj({'authorization_id':st(),'order_id':st(),'stage':{'const':'DELIVERY'},'generation':integer(),'protected_contact_ref':st(),'contact_purpose_ref':st(),'expires_at':{'type':'string','format':'date-time'},'suppression_ref':st()},['authorization_id','order_id','stage','generation','protected_contact_ref','contact_purpose_ref','expires_at'])
SCHEMAS['handoff_delegate_invitation__intent_v1']=delegate
registry={'registry_version':1,'revision_date':'13 October 2026','authority':'EVT §9/13/35/47; owner sections below','status':'DOCUMENT-CORRECTED; executable/static design fixtures only','domain_events':ENTRIES,'job_intents':[{'intent_type':'handoff.delegate_invitation','intent_version':1,'owner':'Handoff','producer_refs':['HND §65; NOTIF §6'],'payload_schema_ref':'event_payload_schemas.json#/$defs/handoff_delegate_invitation__intent_v1','scope':'MARKET','allowed_actor_types':['ORDINARY_ACCOUNT','OPERATOR_ACCOUNT','SYSTEM'],'purpose':'Narrow current authorization receipt invitation through existing protected SMS adapter; no ordinary Account invented.','effect_key':'authorization_id + generation + contact_purpose_ref + intent identity','dispatch_gate':'Re-read authorization/current generation/expiry/revocation/suppression immediately before protected contact resolution and send.','transport_limits':'Provider acceptance is not reading/receipt; ambiguous send reconciles under stable identity; no globally exactly-once promise.'}],'compatibility_mappings':[],'compatibility_policy':'Historical released meanings remain immutable. No deployed compatibility evidence supplied; obsolete unreleased handoff.pickup.verified, handoff.delivery.verified, review.eligible, handoff.failed, courier.assignment_created and fulfilment.ready examples are removed from current producers/subscriptions, not emitted as additional aliases.','non_domain_classes':{'analytics_intake':'ANL §11/23 independent observational registry; underscore analytics keys never create commerce truth.','internal_audit':'audit.operator_action, audit.security_event, claims.claim_event, moderation_event and chat.timeline_event are owner audit/timeline records.','commands':'Owner requests may fail; permission capabilities and owner methods are not events.','queue_jobs':'BullMQ queue names and payment.reconcile/reconcile_provider_payment are execution requests, not committed facts.','notification_templates':'Uppercase template keys and transport intent are not ordinary domain-event types.','fields_tables_files_hosts':'Entity field/table names, JSON filenames, module paths and DNS hosts are not inferred as events.'}}
OUT.mkdir(exist_ok=True)
registry['job_intents'][0]['envelope_binding']={'job_type':'intent_type','job_version':'intent_version','payload':'registered protected payload schema','logical_job_id':'durable invitation intent/effect identity'}
(OUT/'event_contract_registry.json').write_text(json.dumps(registry,ensure_ascii=False,indent=2)+'\n')
(OUT/'event_payload_schemas.json').write_text(json.dumps({'$schema':'https://json-schema.org/draft/2020-12/schema','$id':'urn:adulis:current-event-payloads:2026-10-13','$defs':SCHEMAS},ensure_ascii=False,indent=2)+'\n')
(OUT/'event_envelope_schema.json').write_text(json.dumps({'$schema':'https://json-schema.org/draft/2020-12/schema',**envelope},indent=2)+'\n')
print(json.dumps({'domain_events':len(ENTRIES),'job_intents':1,'payload_schemas':len(SCHEMAS),'unique':len({(e['event_type'],e['event_version'])for e in ENTRIES})==len(ENTRIES)}))
