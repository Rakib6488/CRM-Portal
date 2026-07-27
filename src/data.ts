import { CRMContact, SupportTicket, KBArticle } from './types';

export const INITIAL_CONTACTS: CRMContact[] = [
  {
    id: 'c-1',
    name: 'Alice Johnson',
    email: 'alice.johnson@acme.corp',
    phone: '+1 (555) 123-4567',
    company: 'Acme Corp',
    status: 'VIP',
    notes: 'Primary liaison for Acme enterprise license. Demands rapid support on database and sync features.',
    lastContactDate: '2026-07-10T14:30:00Z',
  },
  {
    id: 'c-2',
    name: 'David Smith',
    email: 'dsmith@quantumtech.io',
    phone: '+1 (555) 987-6543',
    company: 'Quantum Tech',
    status: 'Active',
    notes: 'Interested in upgrading to enterprise tier. Evaluated feature requests for multi-agent support.',
    lastContactDate: '2026-07-12T09:15:00Z',
  },
  {
    id: 'c-3',
    name: 'Elena Rostova',
    email: 'elena.r@novasolution.eu',
    phone: '+33 1 42 68 53 00',
    company: 'Nova Solutions',
    status: 'Lead',
    notes: 'Incoming prospect. Reached out regarding billing flexibility and global region support.',
    lastContactDate: '2026-07-11T16:45:00Z',
  },
  {
    id: 'c-4',
    name: 'Marcus Brody',
    email: 'm.brody@museumcorp.org',
    phone: '+1 (555) 303-4040',
    company: 'Museum Corp',
    status: 'Inactive',
    notes: 'Legacy account. Need to follow up about subscription renewal or standard tier downgrade.',
    lastContactDate: '2026-06-15T11:00:00Z',
  },
];

export const INITIAL_TICKETS: SupportTicket[] = [
  {
    id: 't-1',
    contactId: 'c-1',
    contactName: 'Alice Johnson',
    title: 'Enterprise Sync failure under high traffic',
    priority: 'Urgent',
    status: 'In Progress',
    category: 'Technical',
    description: 'During peak hourly sync operations, the server returns 504 gateway timeouts. We need a detailed explanation of rate limiting caps or custom database indexing remedies.',
    createdAt: '2026-07-13T08:00:00Z',
  },
  {
    id: 't-2',
    contactId: 'c-2',
    contactName: 'David Smith',
    title: 'Discrepancy in invoice for June 2026',
    priority: 'Medium',
    status: 'Open',
    category: 'Billing',
    description: 'Our enterprise bill shows 15 active seats, but we deprovisioned 3 seats on June 1st. Please adjust the total and issue a credit note.',
    createdAt: '2026-07-12T11:30:00Z',
  },
  {
    id: 't-3',
    contactId: 'c-3',
    contactName: 'Elena Rostova',
    title: 'Clarification regarding GDPR data retention policy',
    priority: 'Low',
    status: 'Open',
    category: 'General',
    description: 'We require a formal GDPR compliance statement showing physical hosting location of European user databases and standard retention period.',
    createdAt: '2026-07-11T16:50:00Z',
  },
  {
    id: 't-4',
    contactId: 'c-1',
    contactName: 'Alice Johnson',
    title: 'API endpoint for custom webhooks fails',
    priority: 'High',
    status: 'Resolved',
    category: 'Technical',
    description: 'POST payload from our app fails with invalid content-type. Turns out the parser expects strict JSON headers. Resolved by adjusting requests.',
    createdAt: '2026-07-10T15:00:00Z',
  },
];

export const INITIAL_KB_ARTICLES: KBArticle[] = [
  {
    id: 'kb-palmpay-about',
    title: 'About PalmPay Platform & Customer Service Ecosystem',
    category: 'Policy',
    content: `PalmPay is a leading, fully-licensed African fintech platform launched in 2019, regulated by the Central Bank of Nigeria (CBN) and insured by the NDIC. Operating with state-of-the-art secure infrastructure, it serves over 30 million regular app users and a network of 500,000+ mobile banking agents.

### Core User Roles
1. **Regular App Users**: Conduct transfers, bill payments, airtime recharges, and savings on the PalmPay Consumer App.
2. **Mobile Money Agents (POS Users)**: Provide cash-in (deposit) and cash-out (withdrawal) agency services using PalmPay POS Terminals.
3. **Pay with PalmPay Merchants**: Store owners accepting business-to-business payments.

### Official Account KYC Tiers & Limits
* **Tier 1 (Basic)**: Max Single Deposit: NGN 50,000 | Daily Limit: NGN 50,000 | Max Balance: NGN 300,000. Needs registered phone number and legal name.
* **Tier 2 (Medium)**: Max Single Deposit: NGN 100,000 | Daily Limit: NGN 200,000 | Max Balance: NGN 500,000. Requires linked Bank Verification Number (BVN) and matching identity.
* **Tier 3 (Unlimited)**: Max Single Deposit: NGN 1,000,000 | Daily Limit: NGN 5,000,000 | Max Balance: Unlimited. Requires full physical address verification, BVN, utility bill, and Govt ID upload.`,
    author: 'PalmPay FCS Admin',
    createdAt: '2026-07-01T08:00:00Z',
    updatedAt: '2026-07-20T10:00:00Z',
  },
  {
    id: 'kb-palmpay-transfers',
    title: 'Transfer Troubleshooting SOP (Failed, Pending, and Double Debits)',
    category: 'Unable to pay',
    content: `Funds transfer resolution is the highest-volume support request. Agents must follow this exact diagnostic workflow:

### 1. Pending Transfers (In-Flight)
* **Rule**: Transfers stuck as "Pending" or "Processing" are usually undergoing interbank clearing (NIBSS network congestion).
* **Action**: Advise the customer to wait **24 hours** for automatic bank reconciliation.
* **Ticket Logging**: Do not escalate unless 24 hours have elapsed. If still pending, retrieve the **Session ID (30 digits)**, Transaction Reference, Sender/Receiver Account Numbers, and exact Bank Names.

### 2. Failed Transfers but Account Debited
* **Rule**: Transaction state is marked "Failed" in the app, but user balance was deducted.
* **Action**: Explain that the funds are held in the clearing partner's suspense pool. These are automatically reversed to the sender's PalmPay wallet within **24 to 48 working hours** (excluding weekends).
* **Audit**: Check the internal Ledger Tool using the transaction ID to verify if an automatic reversal has already been triggered.

### 3. Double Debits (Network Glitches)
* **Rule**: Customer is charged twice for a single transfer or POS withdrawal.
* **Action**: Request the customer's official bank statement showing both debit timestamps. Log an FCS ticket with both transaction reference hashes. Reversals are processed within 3-5 business days upon validation.`,
    author: 'Operations Escalation Lead',
    createdAt: '2026-07-05T09:00:00Z',
    updatedAt: '2026-07-20T10:30:00Z',
  },
  {
    id: 'kb-palmpay-kyc-bvn',
    title: 'BVN/NIN Verification and Frozen Account Resolution Guidelines',
    category: 'Lock',
    content: `Under Central Bank directives (anti-money laundering and fraud prevention policies), all PalmPay wallets must be verified using valid regulatory credentials.

### Mandatory Verification Rules
* All accounts must have a Bank Verification Number (BVN) and a National Identification Number (NIN) linked.
* The legal names, phone numbers, and dates of birth on the PalmPay profile must perfectly match the details on the national databases (NIBSS for BVN / NIMC for NIN).

### Resolving "Frozen" or "Restricted" Accounts
Accounts are auto-flagged and frozen by the risk engine for the following triggers:
1. **Missing or Mismatched KYC**: Legal name differs from BVN record.
2. **Velocity/Fraud Alert**: Unusually high volumes on a Tier 1 basic account.

### Step-by-Step Unfreezing SOP
To unfreeze an account, instruct the customer or agent to submit:
1. A clear high-resolution selfie holding their physical National ID card / Passport.
2. A copy of their linked BVN slip/profile.
3. A recent Utility Bill (Electricity, Water, or Waste management) matching the stated residential address.
4. Update the ticket status to "In Progress" and route to the **Compliance Risk Operations Team**.`,
    author: 'Compliance Officer',
    createdAt: '2026-07-10T11:00:00Z',
    updatedAt: '2026-07-20T09:45:00Z',
  },
  {
    id: 'kb-palmpay-pos',
    title: 'POS Terminals: Hardware, Connection, and Firmware Troubleshooting SOP',
    category: 'Payment method',
    content: `PalmPay Agents utilize standard Android Smart POS or Classic Linux POS terminals to perform operations. When agents encounter issues, use this guide:

### 1. Connection Errors ("Network Timeout" or "No Connection")
* **SOP**: Check if the POS has a valid SIM card with active mobile data (usually MTN or Airtel partner sims).
* **Action**: Instruct the agent to restart the terminal, navigate to network settings, and toggle Flight Mode ON and OFF to refresh the cellular cell towers. If using Wi-Fi, ensure the local hotspot signal strength is above 60%.

### 2. Error Code: "Issuer Inoperative" or "Declined by Issuer"
* **Rule**: This is not a PalmPay system error. The customer's card-issuing bank is experiencing server downtime.
* **SOP**: Recommend attempting the transaction with an alternative bank card or using the "Transfer to POS Account" feature instead.

### 3. Hardware Errors (Printer Jam / Touchscreen Unresponsive)
* **SOP**: Log a POS Hardware Replacement Ticket. Verify the terminal Serial Number (S/N) printed on the back. Ensure the agent has paid the standard refundable security caution deposit before mailing a replacement terminal.`,
    author: 'POS Hardware Specialist',
    createdAt: '2026-07-12T14:15:00Z',
    updatedAt: '2026-07-20T10:15:00Z',
  },
  {
    id: 'kb-palmpay-commissions',
    title: 'PalmPay Agent Commission Structure & Cashout Wallet Operations',
    category: 'Payment method',
    content: `Mobile money agents earn direct commissions for providing financial services. Keeping commission rules transparent prevents partner churn.

### Standard Commission Rates
* **Cash-Out (Withdrawals)**: 0.5% commission on the total transaction amount, capped at NGN 100 maximum commission per transaction.
* **Cash-In (Deposits)**: NGN 10 flat rate commission for transfers under NGN 5,000. NGN 20 flat rate for transfers above NGN 5,000.
* **Bill Payments (DSTV, GOTV, Electricity)**: 1% up to NGN 100 max per bill payment.

### Wallet Division and Accounting
Each PalmPay Agent Profile contains two distinct virtual balances:
1. **Main Operational Wallet (Agent Balance)**: Used to float cash-out withdrawals and cash-in deposits.
2. **Commission Wallet**: Where all transaction commissions are credited instantly.

### Commission Cashout Rules
* Commissions are paid daily or instantly depending on the terminal tier.
* Agents can cash out their Commission Wallet directly to their Main Operational Wallet at zero fee via the "Commission Cashout" button on the PalmPartner app.
* If an agent reports a discrepancy, pull the transaction log for that specific day and compare the commission formulas. If verified as an under-payment, escalate to the **Agent Payroll & Billing Division**.`,
    author: 'Agent Billing Lead',
    createdAt: '2026-07-15T09:30:00Z',
    updatedAt: '2026-07-20T10:00:00Z',
  },
  {
    id: 'kb-palmpay-onboarding',
    title: 'New PalmPay Agent Onboarding and Terminal Activation SOP',
    category: 'Policy',
    content: `Successful agent onboarding ensures terminal security and minimizes immediate tech support volume. Follow this onboarding verification checklist:

### Stage 1: Document Verification
1. Verify the business has a physical store location (submit 3 store photos).
2. Validate corporate filings (CAC registration docs for Business Tiers).
3. Confirm Bank Verification Number (BVN) matches the applicant's personal identification card.

### Stage 2: Terminal Provisioning & Shipping
1. Allocate an inactive POS Terminal Serial Number (S/N) to the Agent's ID in the PalmPay admin portal.
2. Ensure the safety deposit (caution fee) is received and logged in the CRM profile.
3. Ship the pre-configured terminal via the closest regional hub partner.

### Stage 3: Activation & First-Day Check
1. Guide the agent to insert the security SIM, turn on the device, and execute a "Keys Download" from the supervisor menu to sync transaction encryption keys.
2. Complete a test transaction of NGN 100 to ensure POS gateway connectivity is active.
3. Provide the digital PalmPartner handbook containing support numbers and compliance rules.`,
    author: 'Agent Success Manager',
    createdAt: '2026-07-16T11:00:00Z',
    updatedAt: '2026-07-20T11:00:00Z',
  },
  {
    id: 'kb-palmpay-disputes',
    title: 'Dispute Resolution & POS Chargeback Claims Management SOP',
    category: 'Refund Issue',
    content: `When customers or agents log transaction disputes (e.g., POS terminal debited the cardholder but printed a "DECLINED" or "TIMEOUT" receipt), support agents must resolve the issue using the following dispute resolution guidelines:

### 1. Verification of Transaction Logs
* Ask the cardholder for their bank statement showing the debit timestamp and amount.
* Verify the **RRN (Retrieval Reference Number)**, **STAN (System Trace Audit Number)**, and POS terminal serial number in the transaction query tool.
* Inspect if the transaction status is "SUCCESSFUL" or "FAILED" on the PalmPay local switch database.

### 2. Auto-Reversal and Manual Credit Timelines
* **Local Transfers (PalmPay to PalmPay)**: Instantly reversed or credited.
* **Interbank Transfers (PalmPay to Other Banks)**: Reversed within **24 hours** automatically by NIBSS. If not, log a ticket for manual verification with the settlement team.
* **POS Card Debits (Other Bank Cards on PalmPay POS)**: Reversals are initiated by the cardholder's issuing bank. Auto-reversals occur within **24 to 72 working hours**.
* If an automatic refund does not occur, guide the customer to fill out the standard **PalmPay POS Dispute Form** or submit a chargeback request to their card issuer.

### 3. Arbitration and Documentation Requirements
If the issuing bank files an arbitration dispute, the agent must retrieve the signed transaction charge receipt from the PalmPartner dashboard within **5 working days** to prove the terminal delivered cash or service. Otherwise, the merchant faces a debit chargeback.`,
    author: 'Dispute & Settlement Specialist',
    createdAt: '2026-07-18T10:00:00Z',
    updatedAt: '2026-07-20T11:15:00Z',
  },
  {
    id: 'kb-palmpay-security',
    title: 'Security Protocols, Fraud Prevention, and Account Blocking SOP',
    category: 'Lock',
    content: `PalmPay is committed to maintaining absolute safety across our payments network. When users report suspicious activities, phishing, or account compromise, use this security SOP:

### 1. Emergency Account Locking (Compromise/Phone Theft)
* **Trigger**: A customer reports a stolen phone, unauthorized transaction alerts, or social engineering scams.
* **SOP Action**: Verify identity via security questions (Full Name, Date of Birth, linked BVN, and last 3 transactions). Instantly invoke the **Emergency Account Lock** in the admin dashboard.
* **Effect**: This blocks all outgoing transfers, POS transactions, cash-ins, and card usage immediately.

### 2. Standard Reset and Unblocking Protocols
* **Transaction PIN Reset**: Instruct the customer to perform a biometric check or security question verification on their mobile app to reset their 4-digit transaction PIN. Support agents must **NEVER** ask for or manually set PINs for users.
* **Unfreezing Suspicious Wallets**: If an account was frozen due to automatic risk rules (e.g. high-velocity transfer alerts):
  * Request high-resolution selfie with physical ID (NIN Slip, Voters Card, Drivers License, or Passport).
  * Require a statement explaining the source of funds if transactions exceeded regular Tier limits.
  * Compliance team reviews submitted documents within **12 working hours** before unfreezing.

### 3. Social Engineering and Phishing Red Alerts
* Remind agents and customers: **PalmPay support staff will NEVER ask for your OTP (One-Time Password), Transaction PIN, or login password.**
* Report fraudulent accounts, clone apps, or fake support lines directly to the Compliance and Anti-Abuse division.`,
    author: 'Information Security Lead',
    createdAt: '2026-07-19T09:00:00Z',
    updatedAt: '2026-07-20T11:20:00Z',
  },
  {
    id: 'kb-palmpay-escalation',
    title: 'PalmPay FCS Contact Channels, Support Desk SLA & Escalation Matrix',
    category: 'Policy',
    content: `Customer support agents must prioritize and route customer tickets efficiently based on specific contact channels and severity levels.

### 1. Official PalmPay Customer Care Contact Channels
Ensure customers are redirected to genuine support lines only:
* **Customer Hotline**: +234 201 888 6888 (24/7 Voice Support)
* **Agent Hotline (POS/Partners)**: +234 201 888 6889
* **Support Email**: service@palmpay.com
* **POS Agent Support Email**: pos-support@palmpay.com
* **Official WhatsApp Business Account**: +234 905 500 8888 (Look for verified green badge)

### 2. Support Severity Levels & SLA Response Timelines
Support agents must categorize incoming tickets using these severity levels:
* **Critical (P1)**: Total server downtime, widespread transfer failures, or active system intrusion.
  * *Response Time*: Under 15 Minutes | *Resolution SLA*: 2 Hours.
* **High (P2)**: Individual frozen account with high balance, POS connection failures across a region, or massive double-debit claims.
  * *Response Time*: Under 1 Hour | *Resolution SLA*: 12 Hours.
* **Medium (P3)**: Normal failed transfers, KYC upgrade document reviews, transaction pin resets, or minor terminal glitches.
  * *Response Time*: Under 4 Hours | *Resolution SLA*: 24 Hours.
* **Low (P4)**: General product queries, commission calculation explanations, fee inquiries, or promotional campaigns.
  * *Response Time*: Under 12 Hours | *Resolution SLA*: 48 Hours.

### 3. Escalation Pathways
If a ticket is unresolved within its specified SLA, escalate to:
1. **Tier 1 (FCS Desk)**: Initial customer interaction, basic troubleshooting, ticket creation.
2. **Tier 2 (FCS Operations Specialist)**: Technical dispute review, ledger audits, compliance unfreezing approval.
3. **Tier 3 (Core Engineering & Security)**: Network operations center, database indexing issues, high-risk fraud cases.`,
    author: 'Customer Operations Manager',
    createdAt: '2026-07-20T08:00:00Z',
    updatedAt: '2026-07-20T11:25:00Z',
  },
  {
    id: 'kb-palmpay-livechat-scripts',
    title: 'PalmPay Live Chat Support: Greetings, Basic Probing & Chat Closing Scripts',
    category: 'Policy',
    content: `This knowledge article contains the standard live chat customer support scripts (both in Bengali and English) for greeting customers, probing queries, requesting details, handling misbehavior, and closing chats.

### 1. Greetings & Primary Contact
* **Greetings (EEEEE)**:
  * **Bengali**: ওয়ালাইকুম আসসালাম , PalmPay Limited–এ যোগাযোগ করার জন্য আপনাকে ধন্যবাদ। অনুগ্রহ করে জানান, আপনাকে কীভাবে সহায়তা করতে পারি।
  * **English**: Thank you for contacting PalmPay Limited. Please let me know how we can assist you.
* **General Well-being**:
  * **Bengali**: ভালো আছি , আশা করি আপনিও ভালো আছেন।

### 2. Personal Info Sharing Restriction
* **Personal Info share**:
  * **Bengali**: দুঃখিত, ব্যক্তিগত তথ্য শেয়ার করার সুযোগ নেই। কিস্তি সংক্রান্ত কোনো তথ্য জানার থাকলে অনুগ্রহ করে আমাদের জানান। ধন্যবাদ।
  * **English**: Sorry, there is no way to share personal information. If you have any information regarding installments, please let us know. Thank you.

### 3. Problem Probing & Requesting Details
* **Problem Details**:
  * **Bengali**: আপনার বার্তার জন্য ধন্যবাদ। অনুগ্রহ করে আপনার সমস্যাটি বিস্তারিতভাবে শেয়ার করুন। / অনুগ্রহ করে আপনার তথ্যটি বিস্তারিতভাবে শেয়ার করুন।
  * **English**: Thank you for your message. Please share your issue in detail. / Please share your information in detail.
* **Writing Details**:
  * **Bengali**: অনুগ্রহ করে, আপনার সমস্যাটি লিখিতভাবে বিস্তারিত শেয়ার করেন।
  * **English**: Please share your problem in detail in writing.
* **Ask For Details**:
  * **Bengali**: অনুগ্রহ করে, কি তথ্য জানতে চাচ্ছেন জানাবেন ?
  * **English**: Please tell me what information you would like to know?

### 4. Specialized Probing Questions
* **Repayment Probing**:
  * **Bengali**: অনুগ্রহ করে জানাবেন, আপনি কি মোবাইলের কিস্তি পরিশোধ করছেন?
  * **English**: Please tell me, are you paying your mobile phone installments?
* **Method Probing**:
  * **Bengali**: অনুগ্রহ করে জানাবেন, আপনি কি মোবাইলের কিস্তি পরিশোধ করতে চাচ্ছেন?
  * **English**: Please tell me, do you want to pay for your mobile phone in installments?
* **Full Paid Probing**:
  * **Bengali**: অনুগ্রহ করে জানান, আপনি কি এই মাসের সম্পূর্ণ কিস্তির টাকা পরিশোধ করেছেন?
  * **English**: Please tell me, have you paid the full installment for this month?
* **Check Loan/Installment Amount**:
  * **Bengali**: আপনি যে নম্বর দিয়ে কিস্তিতে ফোন নিয়েছেন, সেই মোবাইল নম্বরটি এবং আপনার নামটি শেয়ার করুন। আপনাকে বিস্তারিত তথ্য জানিয়ে দিচ্ছি।
  * **English**: Please share the mobile number and your name with which you have purchased the phone on installment. We will provide you with detailed information.

### 5. Outbound Calls & Reconnects
* **Asking Number (aaaaa)**:
  * **Bengali**: অনুগ্রহ করে আপনার মোবাইল নাম্বারটি দিয়ে সহযোগীতা করবেন। একজন কাস্টমার সার্ভিস প্রতিনিধি শীঘ্রই আপনার সাথে যোগাযোগ করবেন।
  * **English**: Please provide your mobile number. A customer service representative will contact you shortly.
* **Number General Share (ggggggg)**:
  * **Bengali**: আপনার মোবাইল নাম্বারটি দিয়ে সহযোগীতা করার জন্য ধন্যবাদ। একজন কাস্টমার সার্ভিস প্রতিনিধি শীঘ্রই আপনার সাথে যোগাযোগ করবেন।
  * **English**: Thank you for your cooperation with your mobile number. A customer service representative will contact you shortly.
* **OB Call Reached**:
  * **Bengali**: আমাদের গ্রাহক সেবা প্রতিনিধি ইতিমধ্যেই আপনার সঙ্গে যোগাযোগ করেছেন এবং সমস্যাটি সফলভাবে সমাধান করেছেন।
  * **English**: Our customer service representative has already contacted you and successfully resolved the issue.
* **Recontact Request (Punorai Share)**:
  * **Bengali**: অনুগ্রহ করে অপেক্ষা করুন। আমাদের কাস্টমার সার্ভিস প্রতিনিধি আপনার সাথে পুনরায় যোগাযোগ করবেন। এক্ষেত্রে আপনার মূল্যবান সময় কামনা করছি।
  * **English**: Please wait. Our customer service representative will get back to you. We appreciate your valuable time in this matter.
* **Uncooperative / Switch off Customer Phone**:
  * **Bengali**: আপনার সাথে যোগাযোগ করা হলেও পর্যাপ্ত সহযোগিতা না পাওয়ায় সমস্যাটির সমাধান করা সম্ভব হয়নি। যেকোনো সহায়তার জন্য অনুগ্রহ করে আমাদের হেল্পলাইন নম্বরে যোগাযোগ করুন: 09611678534। ধন্যবাদ।
  * **English**: We have contacted you but we were unable to resolve the issue due to insufficient cooperation. For any assistance, please contact our helpline number: 09611678534. Thank you.

### 6. Managing Difficult Interactions
* **Misbehave Response**:
  * **Bengali**: "আপনার বিষয়টির জন্য আমরা আন্তরিকভাবে দুঃখিত। অনুগ্রহ করে আপনার সমস্যার সকল প্রয়োজনীয় তথ্য আমাদের WhatsApp নম্বরে শেয়ার করুন। আমরা বিষয়টি যাচাই করে প্রয়োজনীয় ব্যবস্থা গ্রহণ করা হবে। আমাদের WhatsApp নম্বর 01335095124। অনুগ্রহ করে WhatsApp-এ মেসেজ দিয়ে কিছুক্ষণ অপেক্ষা করুন, আপনাকে দ্রুতই রিপ্লাই দেওয়া হবে। ধন্যবাদ।"
  * **English**: "We sincerely apologize for your issue. Please share all the necessary information about your problem on our WhatsApp number. We will verify the matter and take necessary action. Our WhatsApp number is 01335095124. Please wait for a while by sending a message on WhatsApp, you will be replied to soon. Thank you."
* **Marzito Language (Speak Elegantly)**:
  * **Bengali**: আপনাকে মার্জিত ভাষায় কথা বলার জন্য অনুরোধ করছি।
  * **English**: I request you to speak in an elegant manner.

### 7. Chat Closing & WhatsApp Channels
* **WhatsApp Inbox Reply Check**:
  * **Bengali**: আপনার WhatsApp মেসেজের রিপ্লাই দেওয়া হয়েছে। অনুগ্রহ করে আপনার WhatsApp ইনবক্সটি চেক করে দেখুন, ধন্যবাদ।
  * **English**: Your WhatsApp message has been replied to. Please check your WhatsApp inbox, thank you.
* **WhatsApp Channel Info**:
  * **Bengali**: আমাদের WhatsApp নম্বর 01335095124। অনুগ্রহ করে WhatsApp-এ মেসেজ দিয়ে কিছুক্ষণ অপেক্ষা করুন, আপনাকে দ্রুতই রিপ্লাই দেওয়া হবে। ধন্যবাদ।
  * **English**: Our WhatsApp number is 01335095124. Please wait a moment by sending a message on WhatsApp, you will be replied to shortly. Thank you.
* **Further greetings**:
  * **Bengali**: আপনাকে কি আরও কোনো তথ্য দিয়ে সহায়তা করতে পারি?
  * **English**: Can I help you with any more information?
* **End Chat**:
  * **Bengali**: PalmPay Limited-এর সাথে যোগাযোগ করার জন্য আপনাকে অসংখ্য ধন্যবাদ। আপনার যেকোনো প্রশ্ন বা সহায়তার প্রয়োজন হলে অনুগ্রহ করে আমাদের লাইভ চ্যাট সাপোর্টে পুনরায় যোগাযোগ করুন। ধন্যবাদ।
  * **English**: Thank you very much for contacting PalmPay Limited. If you have any questions or need assistance, please contact our live chat support again. Thank you.`,
    author: 'PalmPay FCS Admin',
    createdAt: '2026-07-20T11:20:00Z',
    updatedAt: '2026-07-20T11:20:00Z',
  },
  {
    id: 'kb-palmpay-login-payment',
    title: 'PalmPay App Login & Mobile Payment Troubleshooting (bKash & Locked Screen)',
    category: 'APP Issue',
    content: `This SOP guides the support agents on troubleshooting PalmPay App login issues, handling bKash payment options, addressing OTP delays, and assisting with login PIN resets.

### 1. PalmPay App Login & Payment Process
Explain the step-by-step process for logging in and paying:
* **Bengali**: 
  নিচে Palmpay App লগইন ও পেমেন্ট প্রক্রিয়া ধাপে ধপে উল্লেখ করা হলো:
  * **লগইন প্রক্রিয়া**:
    1. যে মোবাইল নম্বর দিয়ে ফোনটি কেনা হয়েছে, সেই নম্বর ব্যবহার করে Palmpay App-এ লগইন করুন।
    2. আপনার মোবাইলে প্রাপ্ত OTP কোডটি ভেরিফাই করুন।
    3. একটি PIN সেট করুন (PIN-এর প্রথম সংখ্যা ০ হতে পারবে না, ধারাবাহিক সংখ্যা যেমন 1234 বা একই সংখ্যা যেমন 11/22 ব্যবহার করবেন না)।
  * **পেমেন্ট প্রক্রিয়া**:
    4. "Repay" অথবা "Pay Now" অপশনে ক্লিক করুন।
    5. পেমেন্ট মেথড হিসেবে bKash নির্বাচন করুন।
    6. আপনার bKash ওয়ালেট থেকে OTP এবং PIN ব্যবহার করে পেমেন্ট কনফার্ম করুন।
    7. পেমেন্ট সফল হলে "Payment Successful" বার্তা প্রদর্শিত হবে ✅
* **English**:
  Below is the step-by-step process for Palmpay App login and payment:
  * **Login Process**:
    1. Log in to the Palmpay App using the mobile number with which the phone was purchased.
    2. Verify the OTP code received on your mobile.
    3. Set a PIN (The first digit cannot be 0, do not use 1234 or consecutive numbers, do not use repeating numbers like 11/22).
  * **Payment Process**:
    4. Click on the "Repay" or "Pay Now" option.
    5. Select bKash as the payment method.
    6. Confirm the payment using the OTP and PIN from your bKash wallet.
    7. "Payment Successful" message will be displayed once the payment is completed successfully ✅

### 2. Device Locked Screen Payment Method
Inform users that payment is fully supported even when the device is locked:
* **Bengali**: স্যার, ডিভাইস লক থাকা অবস্থাতেও আপনি পেমেন্ট করতে পারবেন। লক স্ক্রিনের Apps অপশন থেকে PalmPay App-এ লগইন করে পেমেন্ট সম্পন্ন করুন।
* **English**: Sir, you can make payments even when the device is locked. Log in to PalmPay App from the Apps option on the lock screen and complete the payment.

### 3. APP OTP Issues & Troubleshooting
If the customer is experiencing delays or is unable to receive OTPs, advise them to:
1. Restart their mobile phone and try logging in again.
2. Use the registered mobile number and place the SIM specifically into SIM Slot 1.
3. Ensure a strong and stable cellular network. If needed, try using a different cellular SIM network.
4. Keep all phone Notification options turned ON.
5. Disable SMS/Message Blocks or DND (Do Not Disturb) settings.
6. Clear up their SMS inbox space by deleting old messages if it's full.
7. Note that operator-end delays are common, and they can wait a few minutes and try again.

### 4. Resetting Forgot Login PIN
Provide the following instructions to reset a forgotten App PIN:
1. Tap the "Forgot PIN / পিন ভুলে গেছেন" option on the App login screen.
2. Enter the OTP sent to the registered mobile number.
3. Set and confirm the new 4-digit PIN. Keep in mind:
   * PIN's first digit cannot be 0 (zero).
   * Do not use consecutive digits like 1234.
   * Do not use identical digit pairs like 11, 22.
4. Log in again with the newly created PIN.

### 5. Other Number Login Restriction
Remind the customer that only the official phone-purchase number is valid for App operations:
* **Bengali**: যে মোবাইল নম্বর দিয়ে ফোনটি কেনা হয়েছে, সেই নম্বর ব্যবহার করে PalmPay App-এ লগইন করুন এবং পেমেন্ট সম্পন্ন করুন। অন্য কোনো নম্বর দিয়ে লগইন করে পেমেন্ট করা যাবে না। ধন্যবাদ।
* **English**: Please login to the PalmPay App using the mobile number you used to purchase the phone and complete the payment. Payment cannot be made by logging in with any other number. Thank you.

### 6. Nagad Payment Support Status
* **Bengali**: বর্তমানে PalmPay অ্যাপে নগদের মাধ্যমে পেমেন্ট করার অপশন বন্ধ রয়েছে। PalmPay অ্যাপ থেকে শুধুমাত্র বিকাশের মাধ্যমে পেমেন্ট করা যাবে।
* **English**: Currently, payment via Nagad on the PalmPay app is disabled. Only bKash payments are supported within the app.

### 7. bKash Wallet Problem Workaround
If there are internal app errors with bKash:
* **Bengali**: Palmpay App থেকে বিকাশ পেমেন্ট করতে সমস্যা হলে ,আপনি যেকোনো Tecno, Infinix, Itel শোরুমে গিয়ে কিস্তি পরিশোধ করতে পারবেন। শোরুমে পরিশোধ করলে পেমেন্ট সাথে সাথে আপডেট হয়।
* **English**: If you are having trouble making a bKash payment from the Palmpay App, you can visit any Tecno, Infinix, Itel showroom to pay the installment. If you pay at the showroom, the payment is updated immediately.`,
    author: 'Compliance & Integration Lead',
    createdAt: '2026-07-20T11:20:00Z',
    updatedAt: '2026-07-20T11:20:00Z',
  },
  {
    id: 'kb-palmpay-manual-showroom',
    title: 'PalmPay Alternative Payment Methods: Manual Offline bKash & Showroom Repayments',
    category: 'Payment method',
    content: `This SOP outlines alternative repayment channels available to PalmPay customers when the standard app-based bKash payment fails or when the registered SIM card is lost or damaged.

### 1. Manual/Offline Payment Instructions
If the user's registered SIM is lost, damaged, or cannot log in, they can perform manual offline payments:
* **Official Merchant Number**: **01332546637** (Official bKash/Nagad Merchant Wallet)
* **SOP**: Customers make payments to the merchant number and submit their details via the official repayment voucher tracking form.
* **Payment Update Tracking Link**: https://mingdaoyun.palmpay-inc.com/public/form/396a12237549437383494a84295dadca
* **Mandatory Voucher Form Fields (📌 Instructions for filling the form)**:
  * **Loan Phone No**: The registered mobile number with country prefix added (\`088\` prefix required, e.g., \`088017xxxxxxxx\`).
  * **Pay Channel**: Select the billing channel (bKash).
  * **Transaction ID**: Exact TxnID string from bKash (warn customer to check 0 vs O and 1 vs i).
  * **Payment Amount**: Exact amount in BDT paid.
  * **Repayment Date**: Date of transfer.
  * **Receipt**: Upload a clear screenshot of the bKash payment notification.
  * **Remark**: Optional notes.

### 2. Physical Showroom Repayments (Tecno, Infinix, Itel)
Physical showroom repayments update the customer's balance instantly:
* **Bengali**: স্যার, আপনার এলাকার যেকোনো Tecno, Infinix অথবা itel শোরুমে গিয়ে কিস্তি পরিশোধ করতে পারবেন। শোরুমে কিস্তি পরিশোধ করলে পেমেন্ট তাৎক্ষণিকভাবে আপডেট হয়ে যাবে।
* **English**: Sir, you can pay the installment by visiting any Tecno, Infinix or itel showroom in your area. If you pay the installment at the showroom, the payment will be updated instantly.
* **Providing Showroom Contacts Policy**:
  * **Bengali**: দুঃখিত, আমাদের এখান থেকে শোরুমের নম্বর বা শোরুম সংক্রান্ত তথ্য প্রদান করা সম্ভব নয়। অনুগ্রহ করে আপনার নিকটস্থ যেকোনো Tecno, Infinix অথবা itel শোরুমে সরাসরি যোগাযোগ করুন।
  * **English**: Sorry, we are unable to provide showroom numbers or showroom information from here. Please contact any Tecno, Infinix or itel showroom near you directly.
* **Showroom Visit Advice**:
  * **Bengali**: এ বিষয়ে বিস্তারিত তথ্যের জন্য অনুগ্রহ করে আপনার নিকটস্থ যেকোনো Tecno, Infinix অথবা itel শোরুমে সরাসরি যোগাযোগ করুন। ধন্যবাদ।
  * **English**: For detailed information on this matter, please contact any Tecno, Infinix or itel showroom near you directly. Thank you.

### 3. SIM Replacement or Damage Workarounds
* **Bengali**: আপনার যদি কোনো কারণে সিম হারিয়ে বা নষ্ট হয়ে যায়, তাহলে সিম রিপ্লেস করে নিতে হবে। যদি কোনো কারণে সিম রিপ্লেস করতে না পারেন, তাহলে আপনি যেকোনো Tecno, Infinix বা Itel শোরুমে গিয়ে কিস্তি পরিশোধ করতে পারবেন।
* **English**: If you lose or damage your SIM for any reason, you will need to replace it. If you are unable to replace your SIM for any reason, you can visit any Tecno, Infinix or Itel showroom and pay in installments.

### 4. Expatriates / Payments from Abroad
How expat owners can keep up with their EMI commitments:
* **Bengali**: আপনি যদি প্রবাসী হয়ে থাকেন, তাহলে বাংলাদেশে আপনার পরিচিত কোনো ব্যক্তির মাধ্যমে কিস্তির অর্থ পরিশোধ করাতে পারবেন। তাদের মাধ্যমে বাংলাদেশের যেকোনো Tecno, Infinix, Itel শোরুমে সরাসরি পেমেন্ট করা যাবে। এছাড়াও, বিকল্পভাবে ম্যানুয়াল bKash অথবা Nagad এর মাধ্যমেও কিস্তি পরিশোধ করা যাবে।
* **English**: If you are an expatriate, you can have the installment payment made through someone you know in Bangladesh. Through them, the payment can be made directly at any Tecno, Infinix, Itel showroom in Bangladesh. Alternatively, the installment payment can also be made through manual bKash or Nagad.`,
    author: 'Offline Operations Coordinator',
    createdAt: '2026-07-20T11:20:00Z',
    updatedAt: '2026-07-20T11:20:00Z',
  },
  {
    id: 'kb-palmpay-emi-policies',
    title: 'PalmPay EMI & Installment Policies, Cash Loans & Full Repayments',
    category: 'Policy',
    content: `This SOP contains the detailed pricing terms, platform fees, early settlement policies, late fees, and customer-facing terms for both the old and new PalmPay EMI schemes in Bangladesh.

### 1. Old EMI Fee Structure (Reference Only)
* **Platform Fee**: One-time charge of **10%** of the total Product Recommended Retail Price (MRP).
* **Loan Risk Fee**: One-time charge of **1%** of the total loan amount.
* **Service Charge**: Monthly rate of **2%** of the loan amount during the EMI tenure.
* **Membership Fee**: One-time charge of **BDT 25**.
* **Mandatory Savings**: **5%** of the total loan amount, held and adjusted against the final installments.
* **Additional Policy**: Installments must be paid on schedule, or late fees will be applied.

### 2. New EMI Fee Structure (Active)
EMI calculations are based strictly on the Product MRP:
1. **Platform Fee**: One-time charge of **10%** of the total MRP.
2. **Digital Data Processing Fee**: One-time charge of **3%** of the total loan amount.
3. **Service Charge**: Monthly rate of **2%** of the loan amount every month during the active EMI tenure.
4. **Digital Onboarding Fee**: One-time payment of **BDT 300**.
5. **Prepayment**: Set dynamically based on the individual customer risk profile.
6. **Important Conditions**: Late payments will trigger penalties and result in device lockouts as per the active policy.

### 3. Early Settlement Policy (No Discount)
If a customer requests to clear all their EMI dues early, there are no interest discounts:
* **Bengali**: আপনি চাইলে সকল কিস্তি একসাথে পরিশোধ করতে পারবেন। তবে আমাদের কোম্পানির নীতিমালা অনুযায়ী কোনো ডিসকাউন্ট দেওয়ার সুযোগ নেই। আপনাকে সম্পূর্ণ কিস্তির টাকা পরিশোধ করতে হবে।
* **English**: If you want, you can pay all the installments at once. However, according to our company policy, there is no opportunity to give any discount. You have to pay the full installment amount.

### 4. Offers and Cashback Bonuses
* **Bengali**: দুঃখিত, সম্পূর্ণ কিস্তি পরিশোধ করার পর বর্তমানে আমাদের কোনো বোনাস অফার চালু নেই। ধন্যবাদ।
* **English**: Sorry, we currently do not have any bonus offers available after paying the full installment. Thank you.

### 5. App Download Link
* **Official Link**: https://apply-h5.palmpaybd.com/download/bd
* **Bengali**: নিচের লিংক থেকে অনুগ্রহ করে PalmPay App ডাউনলোড করুন। অ্যাপটি ইনস্টল করার পর যদি লগইন বা পেমেন্ট সংক্রান্ত কোনো সমস্যার সম্মুখীন হন, অনুগ্রহ করে আমাদের জানান। আমরা আপনাকে সহায়তা করতে প্রস্তুত আছি। ধন্যবাদ।
* **English**: Please download the PalmPay App from the official link. If you encounter any login or payment related issues after installing the app, please let us know. We are ready to assist you. Thank you.

### 6. Loan Payment & Repayment History Reviews
* **Bengali**: আপনার লোন সম্পর্কিত বিস্তারিত সকল তথ্য পাম্পপে (PalmPay) অ্যাপে দেওয়া রয়েছে। তথ্যগুলো দেখার জন্য অনুগ্রহ করে যে নম্বরটি দিয়ে ফোন কিনেছেন, সেই নম্বরটি ব্যবহার করে অ্যাপে লগইন করুন। লগইন করার পর অ্যাপের 'Loan Overview' বা 'ঋণ বিবরণী' অপশন থেকে আপনার সম্পূর্ণ কিস্তির তথ্য এবং লেনদেনের বিবরণ দেখে নিতে পারবেন।
* **English**: All the details related to your loan are provided in the PalmPay app. To view the info, please login using the registered number. You can view your complete installment info and transaction details from the 'Loan Overview' or 'Loan Statement' section of the app.

### 7. Cash Loan policy
* **Bengali**: PalmPay Limited শুধুমাত্র কিস্তির মাধ্যমে Tecno, Infinix এবং itel মোবাইল ফোন প্রদান করে থাকে। বর্তমানে আর্থিক ঋণ (Cash Loan) সার্ভিসটি চালু নেই। ভবিষ্যতে চালু হলে অবশ্যই আপনি এই সুবিধা গ্রহণ করতে পারবেন। আমাদের সাথেই থাকুন। ধন্যবাদ।
* **English**: PalmPay Limited provides Tecno, Infinix and itel mobile phones only through installments. Currently, the Cash Loan service is not available. If it is available in the future, you will definitely be able to avail this facility. Stay with us. Thank you.`,
    author: 'Billing Lead Specialist',
    createdAt: '2026-07-20T11:20:00Z',
    updatedAt: '2026-07-20T11:20:00Z',
  },
  {
    id: 'kb-palmpay-device-locking',
    title: 'Device Locking, Screen Watermarks & Troubleshooting Guides',
    category: 'Watermark issue',
    content: `This SOP details the phased enforcement mechanism applied to PalmPay devices when installment deadlines are missed, including watermarks, lock screens, and partial payment rules.

### 1. Phased Enforcement Stages
* **Due Date (Last Day)**: A floating text watermark is overlaid on the screen reminding the user to clear their payment.
* **Watermark Removal**: The watermark automatically disappears once the payment has cleared the network. If the watermark persists, advise the user to perform a hard reboot (Restart) and ensure a stable, active internet connection.
* **Late Overdue (Day after due date)**: An "Installment Payment Due" lock screen block is applied to the device, restricting calls, network, and general app usage in phases.

### 2. Time Extension Requests Policy
Support agents are strictly prohibited from manually extending payment dates:
* **Bengali**: স্যার, আন্তরিকভাবে দুঃখিত—বর্তমানে কিস্তির সময় বাড়ানোর সুযোগ নেই। নির্ধারিত তারিখের মধ্যে পেমেন্ট সম্পন্ন না করলে ফোন লক এবং জরিমানা প্রযোজ্য হতে পারে। সম্পূর্ণ কিস্তি পরিশোধ না করা পর্যন্ত মোবাইল আনলক করা সম্ভব হবে না। অতএব, অনুগ্রহ করে নির্ধারিত তারিখের আগেই পেমেন্ট সম্পন্ন করুন। ধন্যবাদ।
* **English**: Sir, I am sincerely sorry—currently there is no option to extend the installment period. Failure to complete the payment by the due date may result in phone lock and penalty. Also, the mobile will not be unlocked until the full installment is paid. Therefore, please complete the payment before the due date. Thank you.

### 3. Partial Payment Policy
While customers can pay partial amounts, the device will remain locked until the entire monthly bill is cleared:
* **Bengali**: আপনি চাইলে যেকোনো পরিমাণ অর্থ পরিশোধ করতে পারবেন। তবে নির্ধারিত শেষ তারিখের মধ্যে সম্পূর্ণ মাসিক বকেয়া পরিশোধ করা বাধ্যতামূলক। অন্যথায় আপনার ডিভাইসটি লক হয়ে যেতে পারে এবং সম্পূর্ণ বকেয়া পরিশোধ না করা পর্যন্ত আনলক করা সম্ভব হবে না। ধন্যবাদ।
* **English**: You can pay any amount you want. However, it is mandatory to pay the full monthly dues by the due date. Otherwise, your device may be locked and will not be able to be unlocked until the full dues are paid. Thank you.

### 4. Billing Cycle Limit Rule
* **Bengali**: যে মাসের কিস্তি, আপনাকে সেই মাসেই পরিশোধ করতে হবে। অন্য মাসে পরিশোধ করার কোনো সুযোগ নেই।
* **English**: You have to pay the installment in that month. There is no option to pay in another month.

### 5. Developer Option and App Removal Policies
* **Developer Options**:
  * *Bengali*: সকল কিস্তি পরিশোধ করার পর আপনি Developer Option চালু করতে পারবেন। অনুগ্রহ করে সব কিস্তি পরিশোধ করে তারপর চেষ্টা করুন।
  * *English*: You can enable Developer Option after paying all installments. Please pay all installments and then try.
* **App Deletion / Removal**:
  * *Bengali*: আপনি সকল কিস্তি পরিশোধ করার পর PalmPay App আপনার ফোন থেকে আনইনস্টল করতে পারবেন। অনুগ্রহ করে সকল কিস্তি সম্পূর্ণ পরিশোধের পর অ্যাপটি ডিলিট করার চেষ্টা করুন। ধন্যবাদ।
  * *English*: You can uninstall PalmPay App from your phone after paying all installments. Please try deleting the app after paying all installments in full. Thank you.`,
    author: 'Risk & Control Specialist',
    createdAt: '2026-07-20T11:20:00Z',
    updatedAt: '2026-07-20T11:20:00Z',
  },
  {
    id: 'kb-palmpay-specialized-sops',
    title: 'PalmPay Specialized SOPs: Refunds, Death Cases, Stolen Devices & Merchant Onboarding',
    category: 'Reset Phone',
    content: `This SOP covers specialized legal and compliance scenarios including police recovery of stolen devices, unblocking reflashed/reset phones, processing bKash refunds, and death-case waivers.

### 1. Stolen Phone Recovery & Police Unlocking SOP
When a phone is stolen and recovered by the police, they must submit an request to release the PalmPay device lock:
* **Official Email**: customerservices@palmpay-inc.com
* **Strict Submission Guidelines**:
  1. The email MUST be sent from the official police station or police force email address.
  2. The email body must contain:
     * Customer Name
     * Phone Name & Model
     * IMEI 1 and IMEI 2 numbers
     * Detailed police recovery details
     * Desired unlock duration and reason for unlock
  3. The email must be drafted in English.
  4. The investigating officer's official and personal contact mobile numbers must be provided.
  5. The GD (General Diary) copy or court case file/court order MUST be attached in PDF format.

### 2. Flashed / Factory Reset Under Loan
If a customer resets or flashes their phone while their loan is active, they must register the reset:
* **SOP Action**: Email customerservices@palmpay-inc.com with subject: \`Device Reset Notification (Under Loan) - [Phone IMEI Number]\`
* **Required details**: Customer name, registered mobile, brand/model, IMEI 1 & 2, reset date, screenshot of the current screen.
* **Consent Requirement**: A written commitment (consent statement) must be included stating that they will not flash or factory reset the device again until the loan is fully closed.

### 3. Refunds Processing SOP (bKash, Nagad & Bank Transfer)
If double-debits or mistaken payments occur, customers can request refunds:
* **Mobile Refunds (bKash/Nagad)**: Email customerservices@palmpay-inc.com with their NID, payment screenshot, and refund request details.
* **Bank Payments Refund**: Send bank transfer details to customerservices@palmpay-inc.com with Account name, number, SWIFT, routing, and bank address.

### 4. Outstanding EMI Waiver on Customer Death
If a customer passes away, the nominee or family can request an EMI Waiver (Waive Off):
* **SOP Action**: Family submits the following documents to the nearest Sales Officer or registered showroom:
  1. Online Death Certificate (issued by the government).
  2. Copy of NID (both sides) of the registered nominee.
  3. NID of the family member applying and supporting documents.
  4. Acknowledgement / Clearance Letter from the physical retail shop where the device was purchased.
  5. Screenshots of the EMI-related interfaces on the Repayment and PalmPartner apps.

### 5. Escalated Complaint Management
* **Bengali**: স্যার, আপনার বিষয়টি সমাধানের জন্য একটি অভিযোগ (Complaint) রাখা হয়েছে এবং প্রয়োজনীয় ব্যবস্থা গ্রহণের জন্য সংশ্লিষ্ট টিমের কাছে পাঠানো হয়েছে। বর্তমানে বিষয়টি নিয়ে কাজ চলমান রয়েছে। অনুগ্রহ করে অপেক্ষা করুন। কোনো আপডেট পাওয়া মাত্রই আপনাকে জানানো হবে। ধন্যবাদ।
* **English**: Sir, a complaint has been filed to resolve your issue and has been forwarded to the concerned team for necessary action. The matter is currently being worked on. Please wait. You will be informed as soon as there is any update. Thank you.`,
    author: 'Operations Escalation Manager',
    createdAt: '2026-07-20T11:20:00Z',
    updatedAt: '2026-07-20T11:20:00Z',
  },
  {
    id: 'kb-palmpay-merchant-partners',
    title: 'Merchant Partnerships, Device Sales & Purchase Requirements',
    category: 'Policy',
    content: `This SOP contains guidelines for retail partners, merchants, device return rules, and customer purchase requirements.

### 1. Consumer Mobile Purchase Requirements
To buy a Tecno, Infinix, or Itel mobile phone on installments through PalmPay, the consumer must provide:
* **Primary Documents**:
  * Original National Identity Card (NID) of the buyer.
  * Official Job ID Card.
  * Bank statement or bKash wallet statement for the last 30 days.
  * Reference contact of a coworker.
  * Original NID and active mobile number of a guarantor.
* **Action**: Guide the applicant to visit the nearest authorized showroom with these documents.

### 2. Merchant Store Registration & Retailer Access
For store owners wanting to register as PalmPay Merchants to sell devices:
* **Required Documents**:
  * Shop owner's NID and Passport size photo.
  * TIN Certificate & Trade License.
  * Store Email ID.
  * Bank Account Statement or Mobile Banking details (with a copy of a cheque leaf).
  * BIN Certificate / Business Identification Number.
  * Nominee's NID and Passport size photo.
* **Onboarding process**: Submit documents as a PDF to the regional brand manager, who forwards them to merchant.support@palmpay-inc.com.
* **Access Information**: Access (including retailer codes) is restricted until the verification and onboarding checklist is fully approved.

### 3. Exchange & Return Policies
* **Device Returns under Loan**:
  * *Bengali*: আপনি যদি লোন পরিশোধ করতে না পারেন, তাহলে চাইলে মোবাইল ফোনটি রিটার্ন করতে পারবেন। তবে মোবাইল ফোন রিটার্ন করলে কোম্পানির নীতিমালা অনুযায়ী কোনো টাকা ফেরত দেওয়া হয় না। মোবাইল ফোন রিটার্ন করার জন্য নিকটস্থ শোরুমে যোগাযোগ করুন।
  * *English*: If you are unable to repay the loan, you can return the mobile phone. However, as per company policy, no refund is provided on returns. Please visit the nearest showroom to coordinate.
* **Device Exchanges Policy**:
  * *Bengali*: দুঃখিত, দোকান থেকে ডিভাইস অ্যাক্টিভেট করার পর ফোন এক্সচেঞ্জ করার সুযোগ নেই। ধন্যবাদ।
  * *English*: Once the device is activated in-store, device exchanges are strictly not allowed.

### 4. Carlcare Service Center Referrals
If a customer has hardware or screen issues:
* **Bengali**: আপনার সমস্যাটির জন্য অনুগ্রহ করে নিকটস্থ Carlcare Service Center–এর সাথে যোগাযোগ করুন। Carlcare Service Center থেকে আপনাকে প্রয়োজনীয় সহায়তা প্রদান করা হবে। নিকটস্থ Carlcare Service Center–এর ঠিকানা জানতে অনুগ্রহ করে আপনার এলাকার জেলা ও বিভাগের বিস্তারিত তথ্য শেয়ার করুন। ধন্যবাদ।
* **English**: Please contact the nearest Carlcare Service Center for hardware issues. They will assist you. Please provide your district and division to get the closest location.`,
    author: 'Merchant Onboarding Lead',
    createdAt: '2026-07-20T11:20:00Z',
    updatedAt: '2026-07-20T11:20:00Z',
  }
];

