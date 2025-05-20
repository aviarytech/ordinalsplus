# ordinals-inscription-flow-enhancement Phase 2 – Product Requirements Document

&#x20;*Figure: The Ordinals Plus initiative aims to bring trust and authenticity to Bitcoin inscriptions through decentralized identity (DID) and verifiable credentials (VC). Our project’s next phase aligns with Ordinals Plus specifications to enhance inscription flows with verifiable metadata, credential issuance, and DIDs.*

## Introduction

The *ordinals-inscription-flow-enhancement* project is entering Phase 2, focusing on integrating decentralized identity and verifiable credentials into Bitcoin Ordinal inscriptions. In Phase 1, the system enabled basic inscription of content (e.g. images, text) on satoshis via Ordinal Theory, but lacked structured metadata or authenticity proofs. Phase 2 addresses this by introducing **Ordinals Plus Verifiable Metadata**, **Verifiable Credential issuance**, and **Decentralized Identifiers (DIDs)** as defined in the emerging Ordinals Plus standards. By embedding machine-verifiable metadata and linking inscriptions to DIDs, the platform will allow trustless verification of an inscription’s properties, provenance, and ownership.

This document outlines the Product Requirements Document (PRD) for Phase 2. It describes new features and their technical design, centered on the Ordinals Plus v0.2.0 Draft specifications. Key additions include:

* **Ordinal Plus Verifiable Metadata** – Attaching user-provided metadata (e.g. title, description, properties) to inscriptions, formatted as W3C Verifiable Credentials 2.0 and compliant with the BTCO Verifiable Metadata spec. This metadata will be either embedded in or referenced by the inscription on-chain, enabling *trustless verification* of an inscription’s attributes.
* **Verifiable Credential (VC) Issuance** – Integration with *Aces* (the team’s Verifiable Credential API service) to automatically issue cryptographically-signed credentials when inscriptions are made. These credentials adhere to the W3C VC Data Model 2.0 and contain claims derived from the inscription’s content and user-supplied metadata. The flow will define when credentials are issued (e.g. immediately post-inscription) and how the system communicates with the Aces API (including error handling).
* **BTCO DID Method Support** – Implementation of the BTCO DID Method v0.2.0 Draft to associate decentralized identifiers with inscriptions. Each DID is anchored to a specific satoshi (using its unique ordinal number) and allows storing a DID Document (containing public keys, etc.) as on-chain inscription metadata. This enhances provenance and ownership tracking: the DID can represent the creator’s or asset’s identity on Bitcoin, and its keys can be used to sign/verify credentials.
* **BTCO DID Linked Resources** – Support for linking immutable resources (such as credential schemas, collection manifests, images or governance documents) to DIDs via additional inscriptions, per the BTCO DID Linked Resources v0.2.0 spec. This allows rich *metadata ecosystems* around an ordinal: e.g. attaching a verifiable schema or a license document to a collection’s DID. The system will enable creating and resolving these linked resources (by DID and inscription index), ensuring they are stored on-chain and cryptographically verifiable.

Overall, the Phase 2 enhancements aim to transform simple ordinal inscriptions into **“Authentic Assets”** on Bitcoin. By combining NFTs (ordinals) with self-sovereign identity standards (DIDs/VCs), we expand use cases and increase the utility and trust of inscriptions. Users will be able to prove *who created an inscription, what its properties are, and that these claims were verifiably issued*, all through decentralized on-chain data. The following sections detail the goals, requirements, user flows, technical design, and plans to implement these features.

## Project Goals & Objectives

**Goal 1: Enable Verifiable Metadata for Ordinal Inscriptions.** Allow users to include rich metadata with their Bitcoin ordinal inscriptions in a standardized, verifiable format. The metadata will conform to the BTCO Verifiable Metadata spec and W3C Verifiable Credentials Data Model 2.0, meaning each piece of metadata is a cryptographically-signed credential. This objective ensures that any inscription’s descriptive information (e.g. title, description, creation date, content type) can be *independently verified* by others, increasing trust and easing collection curation.

**Goal 2: Integrate Automated Verifiable Credential Issuance (via Aces).** Leverage the Aces VC API to issue credentials without burdening the user with manual steps. The system will automatically generate and sign a verifiable credential at appropriate points in the inscription flow (e.g. immediately after the on-chain inscription is confirmed, or concurrently as part of the inscription transaction). Objectives include defining the data mapping (inscription data -> VC claims) and ensuring reliable communication with the Aces service (with robust error handling and retries). Ultimately, this will provide users with a *“certificate of authenticity”* for each inscription, issued either by the user’s own DID or by the platform’s issuer identity.

**Goal 3: Implement BTCO DIDs for Identity & Ownership.** Introduce decentralized identifiers into the platform so that inscriptions and users can have on-chain identities. Each DID is based on a unique satoshi and will have a DID Document stored via inscription metadata. The objectives are to allow users to create a DID (if they opt in) during inscription, link an inscription to an existing DID if available, and utilize DIDs in credentials (for issuer and subject fields). By doing so, the system enhances provenance: *creators can inscribe their identity along with the artifact*, and owners can update or prove ownership via control of the DID (since controlling the satoshi = controlling the DID Document updates). This aligns with providing **“verifiable digital identities”** on Bitcoin as described by the BTCO DID spec.

**Goal 4: Support DID-Linked Resources for Extended Metadata.** Expand the metadata capability by supporting linked resources per DID Linked Resources spec. The objective is to enable attachment of various resource types (credential schemas, images, license files, etc.) to a DID by inscribing them on the same satoshi and indexing appropriately. For example, a curated collection could have an inscribed logo image or a JSON schema for its credentials, retrievable via a DID URL. This fosters a richer ecosystem where *collections and assets can carry along all relevant info (schema definitions, proofs, visuals) on-chain*, ensuring immutability and easy verification of those resources’ authenticity.

**Goal 5: Adhere to Emerging Standards and Interoperability.** Ensure all implementations strictly follow the Ordinals Plus specifications (v0.2.0 drafts) and W3C standards, to maximize interoperability. This includes compliance with W3C VC 2.0 context and data model, W3C DID Core 1.0 for DID structure, and use of JSON-LD contexts like `https://ordinals.plus/v1` for domain-specific terms. By aligning with standards, the product can interoperate with other tools in the decentralized identity and ordinals space (e.g. any wallet or explorer that supports BTCO DIDs will resolve our DIDs, any VC verifier can verify our credentials, etc.). This objective positions our platform at the forefront of *“Authentic Assets on Bitcoin”* efforts.

## Target Audience

* **Ordinal Creators (Artists/Minters):** Individuals or entities who inscribe content (artwork, collectibles, documents) on Bitcoin using ordinals. They seek to add authenticity and descriptive context to their inscriptions. With Phase 2, creators can prove *they* are the source of an inscription and provide rich descriptions that collectors will see as verified info. This feature appeals to artists wanting to establish provenance and to projects issuing limited-run collectibles with official metadata.

* **Collectors & Buyers:** Users who purchase or trade ordinal inscriptions. They benefit from verifiable metadata as it assures them of an asset’s authenticity, origin, and properties. The integration of DIDs and VCs increases confidence in purchasing decisions – a collector can verify that an inscription is part of an *authenticated collection* or signed by the known creator’s DID. This audience values provenance and may be willing to pay a premium for inscriptions with verifiable credentials.

* **Curators and Collection Managers:** Individuals or organizations curating sets of inscriptions (e.g. digital galleries, communities creating themed ordinal collections). They will use curated collection credentials to establish and publish authoritative collections. This audience needs tools to select certain inscriptions and issue a credential asserting membership in a collection, signed by their curator identity (DID). They also require ways to attach collection-level resources (like a manifesto or rules) via DID-linked resources.

* **Self-Sovereign Identity (SSI) Enthusiasts and Developers:** Technical users interested in the intersection of Bitcoin ordinals and decentralized identity. This includes developers of wallets, explorers, or SSI platforms who want to integrate or verify our DIDs and credentials. They are an indirect audience: by adhering to standards, we enable their applications to consume our data. For example, a wallet developer can use our DID method to resolve an inscription’s DID Document and show a verification badge in their UI. Our open standards approach appeals to this group as it adds a *new layer of identity and trust on Bitcoin*, which they can build upon.

* **Aces Platform Users/Administrators:** Since Aces is our product’s VC issuance service, its maintainers or advanced users form an audience. They need the system to utilize the VC API properly, ensuring credentials are issued in line with Aces’ capabilities. They benefit from increased usage of Aces and demonstration of its integration in a real-world NFT context, potentially attracting more users to the Aces API service as a reliable VC issuer.

## User Personas & User Stories

**Persona 1: “Creative Carol” – An NFT Artist inscribing on Bitcoin**
Carol is a digital artist who has been minting art on Ethereum but recently started creating Ordinal inscriptions for her art pieces. She wants to assure her buyers that any Ordinal carrying her art is indeed an authentic piece from her. Carol uses our platform to inscribe a new image and sees an option to “Add Verifiable Metadata”.

* *User Story:* “As a **creator**, I want to attach verifiable metadata to my inscription that proves I am the creator and provides details about the artwork, so that collectors can verify its authenticity and context.”
* *Acceptance Criteria:*

  * Carol can enter metadata such as **Title**, **Description**, **Creation Date**, and **Category/Medium** in a form when creating the inscription. She can also select her **Creator Identity** (e.g., choose a DID that represents her, or create one on the spot).
  * Upon inscribing, the system produces a **Verifiable Collectible Credential** embedded with the inscription, containing Carol’s provided metadata and identifying her DID as the creator (issuer). The credential is cryptographically signed (e.g., using Carol’s DID key or the platform issuer) and stored on-chain alongside the image.
  * After completion, Carol (and any third party) can use a verification tool or our UI to see a “✅ Verifiable Metadata” badge on the inscription. Clicking it reveals the metadata (title, description, etc.) and shows it was issued by *did\:btco\:Carol…* (Carol’s DID) on a certain date. The verification status should indicate that the signature is valid and the issuer DID is under Carol’s control.
  * If Carol didn’t have a DID prior, acceptance includes that the system guided her to **generate a new DID** for herself during the process. She would have been prompted to securely save a new key (or use an existing wallet key) when creating the DID. The DID creation should succeed without requiring technical steps from Carol beyond confirmation.
  * Any failure (e.g., Aces API failure to issue the VC) is clearly communicated. For instance, if the VC issuance fails, Carol gets a notification that the inscription succeeded *without verifiable metadata*, and an option to “Retry VC Issuance” or contact support. The system should not abandon the inscription; it either attaches the VC or allows Carol to inscribe normally if issues arise.

**Persona 2: “Collector Colin” – A Digital Collector verifying an Ordinal**
Colin collects rare digital artifacts. He finds an Ordinal inscription for sale on a marketplace and wants to ensure it’s not a counterfeit copy. The listing mentions it has “Ordinals Plus verifiable metadata”.

* *User Story:* “As a **collector**, I want to verify an inscription’s origin and properties via its verifiable metadata and DID, so that I can trust I’m buying the genuine item with known provenance.”
* *Acceptance Criteria:*

  * Using either our platform or a third-party wallet that supports BTCO DIDs, Colin can input or scan the inscription’s ID (or DID URL) to retrieve its metadata credential. For example, Colin uses our web app’s verify page, enters the Ordinal’s identifier, and the app uses the DID `did:btco:<sat>/<index>` to fetch the credential.
  * The system shows Colin details like **Title, Description, Creator**, etc., as claimed in the credential, and a verification result: e.g., “Verified ✅ – issued by did\:btco:12345 (Carol’s DID) on 2025-05-10, signature valid.” The app also confirms that *the creator’s DID Document is anchored on Bitcoin* and that the issuer’s key was valid at time of issuance (by resolving the DID Document from chain and checking the key).
  * If any part of verification fails (invalid signature, unknown issuer), the system clearly flags “❌ Verification Failed” with explanation (e.g., “Issuer DID not found” or “Signature mismatch”).
  * Colin should also see if the inscription is part of a **Curated Collection**. For instance, if Carol curated a series, the platform could indicate “Part of Collection: *Carol’s 2025 Collection* (verifiable credential attached)”. Colin can click that and view the collection credential which lists this inscription’s DID among others. Verification of the collection credential shows it was issued by Carol (or another curator’s DID).
  * All of this happens in a user-friendly manner (Colin doesn’t manually decode JSON-LD). The app handles the heavy lifting: resolving DIDs, fetching `/meta` data, and cryptographic checks, then presents a simple trust indicator to Colin.
  * Acceptance means Colin can achieve trust verification **quickly (in seconds)** and without needing to use command-line tools. If using a third-party wallet (out of our control), as long as we follow standards, that wallet should similarly be able to verify and show a checkmark for the credential. Our success criteria includes that any W3C-compliant VC verifier can validate the credentials, and any DID resolver supporting `did:btco` can fetch the DID Document.

**Persona 3: “Curator Caleb” – A Collection Curator**
Caleb runs a digital art collective and curates themed collections of inscriptions from various artists. He wants to formalize these collections on-chain so that anyone can verify membership of an inscription in one of his curated sets.

* *User Story:* “As a **curator**, I want to create a verifiable collection of specific inscriptions, so that I can prove these inscriptions belong to an authenticated collection that I manage.”
* *Acceptance Criteria:*

  * The system provides Caleb with a “Create Curated Collection” workflow. He can input a **Collection Name** and **Description**, and then select or input the identifiers (e.g., DID URLs or Ordinal numbers) of inscriptions to include in the collection.
  * Upon creation, the system issues a **Curated Collection Credential** per the Ordinals Plus spec. This credential includes a list of items (each item identified by a DID, e.g. `did:btco:.../0` for each inscription) and is signed by Caleb’s curator DID. For example, the credential might contain `"items": ["did:btco:1954913028215432/0", "did:btco:1923519999999991/0"]` listing two inscriptions.
  * The credential is then **inscribed on-chain** as an immutable record of the collection. This could be done by inscribing the JSON credential itself (content type `application/vc+json`) on a satoshi that Caleb controls, effectively anchoring the collection credential in Bitcoin. The system might reuse Caleb’s DID anchor or a new sat for this purpose.
  * After creation, for any inscription in that collection, our platform (and any compliant tool) can indicate “This inscription is part of *Collection: \[Name]* (verifiable by curator DID: Caleb’s DID)”. Caleb’s DID Document (on-chain) may also list this collection as a service or linked resource.
  * Acceptance is met if a third-party can independently verify the collection credential: by retrieving it via its DID (e.g., if the collection credential is stored as a DID-linked resource on Caleb’s DID, accessible via `did:btco:CalebSat/Index`), and seeing that the credential’s `issuer.id` matches Caleb’s DID and the signature checks out. Additionally, each item’s DID in the credential should correspond to an actual inscription (the verifier might check that those DIDs resolve to real inscriptions). The system should ensure these conditions (e.g., not allow Caleb to include an invalid inscription ID; the spec requires that if an indexed DID form is used, the inscription must exist).
  * If Caleb updates a collection (adding or removing items), the system likely issues a new credential (version 2) via a new inscription. The older credential remains immutable (could be marked superseded). The user story’s scope is initial issuance; future consideration could be editing collections (which we note as future work).

**Persona 4: “Developer Dana” – Wallet/Explorer Developer**
Dana is integrating support for Ordinals Plus features into a Bitcoin wallet application. She wants to use our project’s functionality (or API) to retrieve and display verifiable metadata for inscriptions.

* *User Story:* “As a **developer**, I want programmatic access to an inscription’s DID and verifiable metadata, so I can display authenticity information in my app and allow users to verify credentials easily.”
* *Acceptance Criteria:*

  * Our system exposes an **API endpoint** (or library) for resolving a `did:btco` DID and retrieving the associated DID Document and/or metadata. For example, a REST GET request to `/did/btco/1066296127976657` returns the DID Document (with appropriate JSON-LD context) for that satoshi if one exists. Another endpoint might allow fetching the verifiable metadata credential for a given inscription (by inscription ID or DID URL).
  * Dana can call `/inscription/<id>/metadata` and receive a JSON response containing either the embedded verifiable credential or a link to it (e.g., if our system caches it). The response must include the credential in full, with its proof, so her wallet app can verify it.
  * She can also query `/did/<did>/resolve` to get resolution output per the DID spec (including `didDocument` and metadata like created/updated timestamps). If the DID has multiple versions (reinscriptions), the API should handle parameters for version or provide `versionId` references.
  * The documentation we provide should detail how to use these endpoints and the data model, aligning with the Ordinals Plus resolution methods (for instance, explaining that appending `/info` or `/meta` to a DID URL yields certain data). Dana’s wallet might use our documentation to implement direct DID URL resolution in her own code as well.
  * The API should enforce security (e.g., rate limiting, and only read operations are needed – write operations like issuing credentials are triggered by our internal flows, not open to public misuse).
  * Acceptance is achieved if Dana is able to integrate our DID/VC retrieval into her wallet such that when a user views an inscription, the wallet can show fields like “Title, Description, Issuer” from the verifiable metadata, and indicate if the signature is valid. This should work reliably for all inscriptions created through our platform with metadata. In case of inscriptions without metadata, the endpoints should return a clear “No metadata available” response so her app can handle that gracefully.

## Functional Requirements

Below are the functional requirements organized by the four major new feature areas.

### 1. Ordinal Plus Verifiable Metadata Integration

* **Metadata Input UI:** The system **must provide a user interface** for creators to input or select metadata when creating an inscription. This includes fields such as *Title, Description, Creation Date, Creator/Artist Name or DID, Content Type*, and possibly custom attributes (traits, properties) depending on the use case. Fields like title and description are mandatory for meaningful metadata, as required by the Verifiable Collectible schema (e.g., name/title and description must not be empty in the credential). The UI should be intuitive and not significantly lengthen the inscription process for users who choose to add metadata.

* **BTCO Verifiable Metadata Structure:** The metadata provided by the user **must be structured into a W3C Verifiable Credential (VC) v2.0 format**, following the BTCO Verifiable Metadata specification. This means the system will create a JSON-LD object with:

  * `@context`: including at minimum the core W3C VC context (`https://www.w3.org/ns/credentials/v2`) and the Ordinals Plus context (`https://ordinals.plus/v1`) which defines BTCO-specific terms.
  * `type`: containing `"VerifiableCredential"` and a specific type such as `"VerifiableCollectible"` or `"CuratedCollection"`, depending on the use case.
  * `issuer`: an identifier for who issues the credential. This should be a DID (e.g., the creator’s DID if available, or a platform DID). The spec mandates using BTCO DIDs for issuer and subject IDs.
  * `credentialSubject`: an object identifying what the credential is about. For an inscription’s metadata, the subject `id` will be the DID of the inscription itself (e.g., `did:btco:<sat>/<index>` identifying that specific inscription). The subject will include claims like `title`, `description`, etc., corresponding to user inputs. (See Technical Design for exact schema mappings.)
  * `issuanceDate` (or `validFrom`): timestamp when the credential is issued.
  * `proof`: a cryptographic proof (signature) section, to be added after signing.

* **Ensuring Required Fields & Schema Compliance:** The system will enforce that all **required metadata properties** for the chosen credential type are present before issuance. For example, for a *Verifiable Collectible Credential* (individual inscription metadata), required properties include `title`, `creator` (DID of creator), `creationDate`, and technical `properties` like content format. For a *Curated Collection Credential*, required fields likely include a collection name/description and the list of item DIDs. If the user input is missing any required field, the UI should prevent proceeding and highlight the missing info. The metadata will conform to the BTCO context definitions to ensure any verifier can interpret the fields correctly.

* **Metadata Embedding in Inscriptions:** The platform **must embed or associate the verifiable metadata with the on-chain inscription** as per the Ordinals Plus spec. According to the BTCO DID Method and Linked Resources specifications, inscriptions can contain a *content part* and a *metadata part* (the latter often encoded in CBOR). We will leverage this to include the credential as the inscription’s metadata:

  * If the inscription’s primary content is an asset file (e.g., an image), the verifiable credential JSON will be attached as *metadata* in the same inscription transaction (likely in a special TLV record or as ordinals protocol extension data in CBOR format). The content byte size and metadata must together stay within ordinals size limits (\~<190 KB).
  * Alternatively, if technical constraints prevent a single transaction from carrying both, the system may perform *two linked inscriptions*: one for the primary content and one for the metadata credential, linking them via DID. For example, the primary inscription could be at index 0 and the credential at index 1 on the same satoshi. The DID for that satoshi would thus reference the credential as `did:btco:<sat>/1`. However, the preferred approach is a single inscription with embedded metadata, to align with the spec’s notion of `/meta` retrieval on the same resource.
  * The implementation will clarify in Technical Design how exactly we embed the metadata. The goal is that when resolving the inscription’s DID, the credential appears via the `/meta` suffix. For example, `did:btco:<sat>/<index>/meta` returns `application/vc+json` content – the verifiable metadata – which is achievable if we stored it correctly and the resolver can detect and return it.

* **Compliance with W3C VC Data Model 2.0:** All credentials produced must be valid according to the W3C VC 2.0 specification (which is largely an evolution of VC 1.1). This includes proper contexts, the presence of an `id` for issuer and subject (using DIDs), a valid ISO8601 date for issuance, and a `proof` section that uses a recognized suite. We will use **Data Integrity Proofs** (previously known as Linked Data Proofs) for signatures, likely employing the *Ed25519Signature2020* or *Multikey* format as suggested by the spec. The BTCO context and DID method support multikey verification methods, so we anticipate using keys like Ed25519 or secp256k1 (multibase encoded in the DID Document) for signing. The system should utilize libraries or the Aces API to generate the proof in compliance with VC 2.0, ensuring the `proof` property contains all required fields (type, created, verificationMethod, proofPurpose, proofValue/jws, etc).

* **Trustless Verification Enablement:** By embedding verifiable metadata, the platform inherently allows *anyone* to later verify an inscription’s data without trusting our server. This is a core requirement: after issuance, the credential can be fetched from the Bitcoin ledger and verified using just the public keys in the issuer’s DID Document and standard cryptographic verification. The design (DIDs + VCs) ensures **decentralized verification**: leveraging Bitcoin’s security and W3C standards means a third party can independently audit authenticity. Our implementation must not introduce any proprietary element that would break this chain of trust. For example, if we include a content hash or reference in the credential, it must correctly correspond to the inscribed content, enabling verification that the metadata matches the on-chain artifact (the spec’s verification rules include “referenced inscription must exist and match the properties” – we will implement such checks during issuance).

* **Optional vs Mandatory Metadata:** The system should allow inscriptions *without* verifiable metadata as well (unless we decide to make it mandatory for all new inscriptions, but that could alienate users who just want a simple inscription). Therefore:

  * The metadata step in the UI can be optional: if the user skips it or disables “Attach Verifiable Metadata”, the system will inscribe the content normally with no VC attached.
  * If metadata is provided, the system will perform additional steps (VC issuance, DID linking) seamlessly. Users who choose not to use these features should still have a smooth experience (just a regular inscription).
  * Internally, we might always create a DID for the satoshi anyway (since any inscription can be represented as a DID), but if the user didn’t provide extra metadata, the DID Document could be minimal or we treat it as not fully initialized. This detail is for technical consistency but not exposed to the user when they skip.

* **Metadata Retrieval & Display:** The system must be capable of retrieving and displaying the verifiable metadata after inscription:

  * On the **inscription detail page** in our UI, if an inscription has attached verifiable metadata, the UI will display the key fields (title, description, etc.) along with a verification status. This requires our back-end to resolve the DID or parse the inscription output to get the metadata VC. We will incorporate a parser for the inscription format (likely using an Ordinals indexer or `ord` tool) to extract the CBOR metadata blob and decode the credential.
  * The UI should highlight that these fields are “verifiable”. For instance, a tooltip or indicator can say “This information is verifiable on-chain” and possibly allow the user to view the raw credential JSON if desired (for transparency).
  * If the user viewing it wants to verify externally, we should provide the DID string and perhaps the raw credential download. However, typical users rely on our built-in verification, which we will ensure is thorough (checking the signature against the DID Document’s public key, etc.).

* **Metadata Editing/Revocation:** Once inscribed, metadata is immutable (as it’s on-chain). If a mistake is made or an update needed, the user would have to create a new inscription or issue a new credential:

  * The system should **warn users** (in the UI) at the time of metadata input that whatever they enter will be permanently recorded and public. This is a critical communication for privacy – e.g., discourage putting sensitive personal data in the description field. We will include helper text about data permanence and privacy.
  * While we cannot truly “edit” on-chain data, in future (see Future Considerations) we might support *revocation or superseding credentials*. For now, it’s out of scope to implement credential revocation lists, but we note that the spec includes a revocation mechanism concept and status tracking. As a stub, if needed, Aces or the platform could issue a **status credential** or maintain a status list (potentially as a DID Linked Resource) that marks credentials revoked. Functional requirement: if the Aces API or our system supports it, we should mark credentials as revoked when appropriate (e.g., user requests to invalidate a credential). This will be logged but full implementation can be a future task. The system should at least be designed to accommodate checking a credential status in verification (e.g., if a status list URL is provided in the VC).

### 2. Verifiable Credential Issuance (Aces API Integration)

* **Integration with Aces VC API:** The platform **must integrate with the Aces (VC issuance) API** to delegate the heavy lifting of credential issuance and signing. Aces is expected to provide endpoints (likely RESTful) for creating and signing verifiable credentials. We will configure secure credentials (API keys or OAuth) for our system to communicate with Aces.

  * **Data Sent to Aces:** When a user finalizes an inscription with metadata, our backend will compile a credential **claim set** and send a request to Aces. The payload will include:

    * The chosen credential type (e.g., “VerifiableCollectible” or “CuratedCollection”) and relevant context URIs.
    * The **issuer information**: either an identifier for the user’s DID (if user is issuer and Aces can sign using the user’s keys or on behalf of that DID), or an identifier for a default platform issuer. We will clarify the issuer strategy:

      * If the user has their own DID and associated key, the ideal is that the credential is issued by that DID. In that case, either the user signs locally (complex UX) or we have Aces sign using a key that represents that DID (meaning Aces might hold or access the user’s DID private key material – not ideal for decentralization unless user trusts Aces). Alternatively, Aces could issue it under its own issuer DID, which still provides value (like a verified badge from a known authority) but slightly centralizes trust. **For MVP, we may have Aces act as the default issuer DID (the “Aces” DID) for all credentials, or for those users who opt not to manage their own keys.** We will allow advanced users to bring their own DID key in future.
    * The **credential subject data**: this will include the subject DID (the ordinal’s DID) and all metadata claims (title, etc.) as provided by the user. Additionally, some claims might be automatically added by the system:

      * For instance, `format` (MIME type of content) and `dimensions` (image resolution) can be auto-detected from the file.
      * `creationDate` can default to the current date (or the block time once inscribed).
      * `creator` field can be set to the user’s DID if available, or to a placeholder if not.
      * We might also include a **content hash** of the inscribed file in the credential (not explicitly in spec, but could go under `properties` as an additional attribute). This would further tie the credential to the exact content.
    * Aces might require a template or schema reference. If needed, we will register the Ordinals Plus credential schemas with Aces beforehand (maybe as part of configuration).
  * **Aces Response Handling:** The Aces API will return either:

    * On success: the fully formed credential in JSON (with `proof` signature). The system will then embed this credential as described above. We must ensure to preserve the proof exactly and not alter the signed fields. The credential might also come with an ID (like Aces might assign a `credentialId` URI); if so, we keep it or perhaps set it to the inscription’s DID URL.
    * On error: an error code/message. The system should log the error and present a user-friendly message or fallback. If an error occurs *before* the Bitcoin transaction is broadcast, we have a choice: either abort the whole process (so the user can fix something and try again), or proceed with the inscription but without the VC. We prefer not to inscribe incomplete data, so likely we will **abort** the process and show an error for the user to retry (unless the user explicitly chooses to continue without metadata).
    * If error occurs *after* broadcasting (e.g., network hiccup after sending TX but before getting VC, which is unlikely since issuance would ideally happen prior), we might provide a way to retroactively issue the credential. For example, a “Retry issuing VC” button on the inscription’s page that calls Aces with the stored data, and then perhaps inscribe a separate credential or mark it off-chain. However, for simplicity, we’ll aim to complete VC issuance before finalizing the on-chain inscription.
  * **Timing and Sync:** The issuance call will be synchronous in the user flow (with appropriate loading indicators). Aces should ideally issue a credential within a couple of seconds. If Aces is slower, we might asynchronously poll for result, but from the user perspective, it’s one flow (they click “Inscribe”, we show “issuing credential…” and then “broadcasting to Bitcoin…”). AI-assisted development will help optimize error handling and parsing of Aces responses, ensuring robust integration.

* **Credential Formation & Signing:** The system (via Aces) must produce credentials that are **cryptographically signed** and conformant:

  * We’ll likely use **data integrity proofs** (JSON-LD proof) with EdDSA (Ed25519 keys) or ECDSA (secp256k1) depending on issuer’s key. The Ordinals Plus spec references a “Multikey” context and modern verification method for flexibility. If Aces supports Ed25519 (common in DID/VC), we might generate an Ed25519 key for the user’s DID to sign credentials. If the user uses their Bitcoin secp256k1 key, Aces/our system might need to use that to sign (which requires a suite like `EcdsaSecp256k1Signature2020`). We will clarify the cryptosuite in Technical Design, but the requirement is that the **verificationMethod in the credential’s proof refers to the issuer DID’s key** (e.g., `did:btco:123456/0#key-1`) and the signature is valid per that key.
  * The system should verify the credential **immediately after issuance** as a sanity check – e.g., use a VC verification library to ensure the proof is valid with the issuer’s public key. This double-check (though Aces should be doing it right) is a safety step before we commit data on-chain.
  * The credential will include a unique identifier if needed. We could use the DID of the inscription plus perhaps a suffix as the credential `id`. This isn’t critical, but nice to have (e.g., `id: "did:btco:<sat>/<index>#metadata"` or a UUID).

* **Flow of Issuance within Inscription Process:** Define the sequence clearly:

  1. User fills metadata form and hits “Inscribe”.
  2. Backend prepares unsigned credential JSON (without proof).
  3. Backend calls Aces API (e.g., `POST /vc-issue`) with the credential data and information on which DID/key to sign with.
  4. Aces returns signed credential or error.
  5. If signed credential received, backend embeds it into the Bitcoin inscription transaction (or prepares the transaction accordingly). If error, handle as described (abort or user choice).
  6. Continue with the normal inscription: fund and broadcast the transaction carrying content + metadata.
  7. Wait for confirmation (optional to wait; could consider inscription complete once broadcast, but confirmation ensures it’s indexed).
  8. Mark the process done and return success to user with the ordinal ID (and DID if applicable).

  If the user opted not to add metadata, steps 2-5 are skipped.

* **Interaction with Bitcoin Transaction Assembly:** Including the credential might require some changes in how we assemble the inscription transaction:

  * In ordinals, to inscribe data, we create a transaction with an `OP_RETURN` output or using the ordinals inscription witness format (with content bytes and content type). The Ordinals Plus approach suggests adding metadata possibly as a **separate field**. If using the reference Ordinals protocol “commit & reveal” transactions, we might embed the metadata in the reveal script (somehow encoded).
  * We’ll likely need to modify the *ord* library or use an extension to include CBOR metadata. This is technical, but the requirement is: **the system must incorporate the additional metadata into the transaction without breaking the Ordinals protocol compliance**.
  * We will adhere to any guidelines from Ordinals Plus on how to include metadata. For example, if the ordinals protocol allows an envelope that contains content followed by a CBOR payload, we’ll use that. If not, we might use an OP\_RETURN output for the metadata (less ideal because it’d be a separate inscription maybe). We will explore options in design, but from a requirements perspective, the solution should not result in orphaned data – the metadata has to be linked to the content on-chain in a standard way.

* **Error Handling & User Notification:** For any failure in the VC issuance:

  * If Aces API is unreachable or returns an error (network issue, auth failure, or validation error like schema mismatch), the system should catch this and inform the user that “Verifiable Metadata issuance failed.” It might present an option: *Try again*, *Proceed without metadata*, or *Cancel*.
  * If the user proceeds without metadata, the system will inscribe only the content. Later, perhaps we allow retroactive metadata (maybe through a separate credential inscription), but that’s not primary flow.
  * All errors should be logged with enough detail (but sensitive info like API keys must not be logged). This helps devs debug and also allows us to analyze failure patterns.
  * We should also implement **fallback for signing**: e.g., if Aces’s signing fails but the user has a local key (maybe if we integrate a wallet), the system could attempt local signing as a backup. However, that might be beyond scope for now. For Phase 2, if Aces fails, we likely abort or proceed sans metadata.

* **Using Metadata in Credential Claims:** The system will map inscription properties into VC claims:

  * **Content Type & Size:** The Ordinal’s content MIME type (like `image/png`, `text/plain`) is known at inscription. We will put this as `format` or `contentType` in the credential’s subject properties. Size could be included under a generic `properties` field if needed.
  * **Satoshi ID / Ordinal Info:** The credential subject’s DID inherently encodes the satoshi ID and index, which ties it to a specific Ordinal inscription. We may also include human-readable fields like the Ordinal number or the transaction ID of the inscription in the credential (perhaps in an evidence field or as part of the credential `id`). However, since the DID alone is a permanent identifier, additional reference might be redundant. The key is that verifiers can resolve the DID to confirm the content.
  * **Ownership / Current Holder:** The verifiable metadata credential is about the inscription’s properties at creation; it is not directly a proof of current ownership (ownership in Bitcoin is who has the UTXO). We will not try to put “owner” in the credential, as that changes with each transfer. Instead, provenance of ownership is handled by Bitcoin itself (UTXO transfers). However, we might note in the credential something like `initialOwner` (the creator’s address or DID) if desired, but that might be confusing if later sold. It’s safer to keep it to static facts.
  * **Link to Collection:** If an inscription belongs to a collection at issuance, we might include a claim like `collection`: `<collection name or DID>`. The curated collection VC serves the global view, but each item’s credential could optionally reference the collection DID as well. This is not required by spec but could be a useful extension for quick reference. We’ll consider this if time permits (non-critical).
  * **Extra Metadata:** We should allow extensibility. The user might have additional attributes (like “rarity”, “series number”, etc.). We’ll provide a way to include these under a generic `attributes` array or similar (the spec mentions optional `attributes` field). The system should take any key-value pairs the user adds and embed them, as long as they don’t conflict with reserved terms and are serializable. This caters to advanced users or future uses without requiring code changes.

* **Security & Privacy in Issuance:**

  * Communications with Aces must be over HTTPS and authenticated. The API keys/tokens for Aces will be stored securely in our system (e.g., in environment variables or a secrets manager).
  * The user’s data being sent (metadata) is not highly sensitive typically (art title, etc.), but we still ensure it’s protected in transit to Aces.
  * The issuance process should not leak any unnecessary user info to Aces beyond what’s needed for the credential. (If Aces is our own service, this is less of an issue, but it’s good practice).
  * The Aces API responses should be validated (e.g., ensure the signature in returned credential is by the expected issuer and that the payload wasn’t tampered). This is an extra check to avoid a scenario where a compromised Aces returns a bogus credential. By verifying immediately using DID keys we have, we add a layer of trust.

### 3. BTCO DID Method Integration

* **DID Creation on Inscription:** The system **shall create a BTCO DID for each inscription that includes verifiable metadata** or where the user requests DID association. According to the BTCO DID Method spec, a DID is identified by a satoshi’s ordinal number. In practice:

  * When an inscription transaction is prepared, we know the satoshi (usually the one being inscribed). The DID will be of the form `did:btco:<satNumber>`. We will include this DID in the metadata (as subject) and in the DID Document that goes on-chain.
  * The DID Document itself needs to be stored. The spec dictates that the DID Document is stored as **metadata in CBOR** in the inscription. To do this, we incorporate a minimal DID Document conforming to the required format:

    * It will have at least the `id` (the DID string),
    * One or more `verificationMethod` entries (public keys),
    * An `authentication` array (often referring to a verificationMethod by ID),
    * Possibly a `service` array if we want to include a service endpoint (maybe to point to an off-chain API, but not needed now).
    * Contexts for DID (`https://www.w3.org/ns/did/v1` and the multikey/security context as needed).
  * **Key Generation:** We need a key pair for the DID. We have two scenarios:

    1. *User brings a key:* If the user has a wallet with a key (say a Bitcoin key or an SSI key), we could use that. But using the Bitcoin key that controls the satoshi has downsides (if they transfer the sat, they might want to pass DID control; plus exposing that key for signing credentials is not ideal). Instead, generating a new Ed25519 key for the DID is a good approach. We can generate an Ed25519 keypair on the fly (or via Aces) and include the public key in the DID Document’s verificationMethod. The private key would need to be stored or given to the user:

       * For now, if Aces is issuing credentials, maybe Aces holds the private key to sign credentials on behalf of that DID. Or we could output a user’s seed phrase or key file at DID creation for them to save (more self-sovereign).
       * A middle-ground: manage keys in the platform (less SSI ethos, but easier UX). Possibly, we let Aces or our backend manage the keys in a secure vault, tagged by user.
    2. *Platform’s key:* Simpler path is to use a platform-controlled key (i.e., the DID is technically controlled by us until user claims it). This would make us an intermediary in signing. However, this contradicts decentralization goals and might break verification if we ever go away. We prefer user-specific keys.
  * **DID Document Insertion:** The requirement is to include the DID Document metadata in the inscription:

    * If we are already embedding the verifiable credential as metadata, we have two pieces of metadata (VC and DID Document). Possibly we combine them or include one within the other. We have to clarify:

      * One approach: The DID Document might be separate from the VC. But maybe we can merge by adding the DID Document into the credential’s proof or as a service? Unlikely; better to keep separate.
      * Perhaps we do *two inscriptions on the same satoshi*: one is the DID Document (with maybe a small dummy content, e.g., a 1x1 pixel or just the CBOR itself as content), and the next inscription is the actual artifact with a reference to the DID. But the spec’s example was to do it in one.
      * Actually, reading the DID spec: *“Create a DID by inscribing it on an unused satoshi... Create an inscription with any valid content, include the DID Document as metadata in CBOR, then register”*. This implies they envision a **single inscription** that carries both the content and DID Document as metadata.
    * Thus, for any inscription where we want a DID, we will structure the transaction to have the DID Document as CBOR metadata. Then resolution of `did:btco:<sat>/0/meta` returns the DID Document JSON, and resolution without `/meta` would presumably return the raw content.
    * We must ensure the DID Document’s `id` exactly matches the intended DID (`did:btco:<sat>`). The spec requires that on resolution, the metadata’s DID Document `id` must match the DID requested.
  * The system will mark the satoshi as now having an active DID. According to spec, once a DID inscription exists, that DID is considered registered to that sat. We should ensure we do not violate the rule “MUST NOT already have a valid DID inscription” for creation:

    * If a user tries to DID-enable an inscription on a sat that already had a DID, we should detect that via our indexer. Perhaps rare case unless user manually inscribed before. If so, we might perform an **Update** instead of Create.

* **DID Linking for Issuer Identity:** Apart from creating a DID for the inscription’s subject, we also want to allow a DID for the **issuer (creator)** if possible:

  * If a user has created their own DID (say Carol created a personal DID on another sat), the platform should let her use that DID as the issuer of credentials. That means:

    * The issuer field in the VC would be Carol’s DID.
    * The credential’s proof must be linked to Carol’s DID’s keys. If Carol manages her own keys, ideally she would sign the credential. That is advanced (maybe Phase 3 to allow external signing flows).
    * Alternatively, Carol might delegate issuance to Aces. In that case, Aces signs but we might include something like an attribute “onBehalfOf: CarolDID”. This is not standard in VC though. So maybe initial approach: by default, platform (Aces DID) is issuer, but we list the creator’s DID in the credential subject or in a custom field.
    * However, since our spec clearly says use BTCO DIDs for issuer and subject and that the issuer *must be the creator or authorized by the creator*, we should strive to have the creator as issuer. We might achieve this by *giving the user an option*: “Issue credential using my own DID (requires connected DID and key)” vs “Issue using Platform issuer”. If user chooses their DID and they have provided their private key (or perhaps sign via a wallet extension), we can incorporate that.
    * If user’s DID is used but they don’t want to or can’t sign locally, one idea: user pre-registers their DID’s verification key with Aces (like upload your DID Document to Aces or point Aces to it) and then *authorizes Aces to use that key*. This is unusual unless Aces actually stores the key (which is like custodianship).
    * For now, we may simplify: if user has a DID with keys managed by us (i.e., we created it, stored key), then we can sign as them easily. If user has an external DID not known to us, we default to platform issuer.
  * The functional requirement is: **Support issuer DID selection.** If user has one or more DIDs in their profile, let them pick which to issue from. If none or they prefer not, default to Aces (platform) DID.
  * In all cases, the *credentialSubject DID* will be the inscription’s DID as described. That anchors the credential to the asset.

* **DID Resolution & Data Retrieval:** The system must implement or leverage a **DID Resolver** for `did:btco` to use within the platform:

  * We will maintain an index or use an Ordinals indexer to map `sat -> latest inscription with metadata`.
  * On resolving a DID, steps per spec:

    1. Parse the DID string (after `did:btco:` get satNumber, optional index if DID URL).
    2. Query the satoshi’s inscription history via our ordinals node/indexer.

       * If a DID URL with an index is given (like `did:btco:<sat>/<n>`), it refers to a specific inscription instance (version or resource). If no index, we want the latest DID Document (latest inscription with metadata on that sat).
    3. Fetch the inscription content and metadata. If our indexer can return the inscription data blob, we decode the CBOR metadata.
    4. Validate the metadata is a DID Document and matches the DID.
    5. Return the DID Document JSON.
  * We will implement this in our backend so that any component can call something like `resolveDid(did:btco:X)` and get the Document. This is used in verifying credentials (to get issuer keys) and can be exposed via API (for external use, as in Dana’s story).
  * The DID Document will include a *verificationMethod* entry for each key. We will assign IDs like `#key-1` appended to the DID. E.g., `did:btco:123456/0#key-1` might be the verificationMethod id. That `#key-1` will be referenced in the credential’s proof verificationMethod. The resolver should ensure these link correctly.
  * We will also support DID URL **path suffixes** as per DID Linked Resources spec:

    * `.../<index>` without any suffix should fetch the raw content of that resource (e.g., an image or a JSON if the content itself was a JSON).
    * `.../<index>/info` should return JSON metadata about that resource (e.g., content type, timestamp, size).
    * `.../<index>/meta` returns the metadata (if any) attached to that resource. For a DID Document inscription, `/meta` gives the DID Document. For an image inscription with a credential attached, `/meta` gives the credential VC.
    * We must implement these resolution rules either internally or via an existing library. This ensures our system can retrieve not just the DID Document but also any linked resource content or metadata by DID URL.

* **User Workflows Involving DIDs:**

  * **DID Creation Workflow:** If a user wants a personal DID (not tied to a particular art piece, but as an identity):

    * We might provide a separate “Create Identity (DID)” feature. The user chooses an unused satoshi from their wallet (or we pick one), and we inscribe a DID Document on it with no significant content (just a DID Document). This yields a DID they can use across many credentials as issuer.
    * The UI for this would be simple: “Create your Bitcoin DID – cost: one inscription fee”. After creation, the DID is listed in their profile.
    * For Phase 2, this is a nice-to-have if time permits, as it’s not explicitly asked for but is implied because we want creators to have DIDs. We will prioritize it if it directly impacts credential issuance quality. Otherwise, the default is using a platform DID.
  * **Linking an Inscription to an Existing DID:** If a user already has a BTCO DID (maybe created via the above or externally):

    * When inscribing, allow them to select “Use my DID as creator” which basically sets the VC’s issuer to that DID. The content’s own DID (the sat’s DID) is separate – that will be for subject.
    * We might also allow linking the new inscription to a DID in terms of *inheritance* (like parent/child). E.g., the spec hints at *Heritage Collections* (parent-child linking via including parent in the TX). That could tie an inscription to a parent DID at creation. This might be advanced and likely beyond current scope.
    * A simpler linking is just conceptual: if Carol has did\:btco\:CarolSat as her identity, any VC issued uses that as issuer, which indirectly “links” her identity to the inscription’s DID through the credential signature.
  * **DID Updates:** Not in immediate scope to implement full update flows, but we note that if a user wants to rotate keys or add new keys, they’d create a new inscription on the same sat (index +1) with an updated DID Document. Our system should be architected to handle DID resolution that might find “the most recent inscription” as the active DID Document.

    * For Phase 2, we likely treat the first inscription as static. But in case we do multiple (like if someone re-inscribes to add linked resources, that might inherently update the DID Document or at least be another entry).
    * We’ll implement resolution such that it always picks the latest inscription with metadata on that sat as the current DID Document, per spec.

* **Provenance and Ownership via DIDs:**

  * Requirement: The solution should improve provenance tracking. By using DIDs:

    * The original creator’s DID is stamped on the asset (in the VC and possibly as controller of the asset’s DID Document keys).
    * If the asset is sold, the DID of the asset remains the same (tied to that satoshi). The new owner can demonstrate ownership by controlling the UTXO. In future, they could prove control by making a new update (like adding a proof of ownership or re-signing something).
    * For now, we rely on the fact that Bitcoin ownership is visible on-chain. If needed, an off-chain verifier can check that the current UTXO for that satoshi is owned by X address (but linking that to a DID is a separate matter).
    * We won’t implement explicit owner verification in this phase beyond what Bitcoin provides, but we note the DID method’s principle: *“the same entity that owns the satoshi also controls the verification keys”* if set up accordingly. We attempt to align with that by possibly deriving the DID key from the satoshi’s owner key or at least letting the owner update keys.
  * The DID provides a *persistent identifier* even if the content gets re-inscribed or referenced. This is valuable for collections: the DID (satoshi) might be considered the identity of a collection, and resources (like collection VCs or logos) hang off it by indices.
  * The system should articulate these benefits to the user in documentation/training: e.g., “Your artifact now has a decentralized identity on Bitcoin, which means its provenance is permanently recorded and any credentials about it can be verified against this identity.”

* **Conformance to BTCO DID Spec:** The implementation must follow the syntax and operations described:

  * DID Syntax: must be exactly `did:btco:<sat>` (only numeric, no hex or other forms for now). If in future name-based or other forms are allowed (the spec notes older versions had names), we focus on numeric as that’s current.
  * We must handle the **2155 trillion** range of satoshi values (0 to 2099999997689999) – essentially any ordinal.
  * DID Operations:

    * **Create** – we do when inscribing DID first time.
    * **Read/Resolve** – we implement as above.
    * **Update** – not fully implemented in UI, but our resolution and data model should not preclude it. (I.e., if we find multiple inscriptions on a sat, possibly mark older as historic. The DID spec’s resolution response even provides `versionId` and `nextVersionId` to handle history. We might implement these fields in our resolver output for completeness.)
    * **Deactivate** – spec mentions marking a DID as inactive via special reinscription. We won’t implement deactivation in this phase, but note as a possible future requirement if needed for security (a user could burn or mark the DID if a key was compromised, by inscribing a tombstone DID Document).

* **User Experience for DIDs:**

  * Many users may not understand DIDs. The UI should abstract the complexity. For instance:

    * When Carol inscribes her art and chooses to add metadata, we might not even mention “DID” explicitly to not confuse her. We can phrase it as “Attach authenticity proof (will create a decentralized identity for this artifact)”. Only advanced sections or documentation mention the DID detail.
    * For power users, in their profile we can show “Your DIDs” and allow copying the DID string or viewing the DID Document.
    * If a user wants to manage their DID keys, we might allow them to export a private key at creation (e.g., display a mnemonic or a JSON keystore for the DID). If not, at least tell them to keep their wallet safe if wallet’s key used.
    * On the verification side, we might show the DID as a short fingerprint or did\:btco:123.. truncated.

### 4. BTCO DID Linked Resources Extension

* **Resource Attachment to DIDs:** The system **shall support linking additional resources to a DID** via inscriptions, as described in the BTCO DID Linked Resources spec. A *resource* in this context is any content we want to immutably associate with a DID beyond the main DID Document. Functional sub-requirements:

  * Users (or the system automatically) should be able to **inscribe resources on an existing DID**. For example, if a DID corresponds to a collection or identity:

    * *Use case:* Caleb (curator) wants to add a logo image for his collection’s DID, and a JSON schema that defines the structure of his collection credentials.
    * Implementation: The system can allow Caleb to upload an image and choose “Link this image as a resource to my DID did\:btco\:X”. The backend then inscribes that image on the same satoshi X (which means creating a new inscription with that sat’s next index). This yields a resource identified as `did:btco:X/<index>`.
    * Similarly, for a schema, the system can inscribe the schema file (JSON content) on sat X.
  * We will maintain an index of resources for each DID. Possibly the DID Document itself might list them (the DID Linked Resources spec implies you might list resource metadata somewhere, maybe in DID Document or via discovery). At minimum, our platform DB can note “did\:btco\:X now has resource at index N with type image/png and resource at index M with type application/json”.
  * **Multiple Resource Types:** We specifically aim to support:

    * **Credential Schema Resources:** If our platform uses a custom schema (context) for credentials, that context document or schema file can be inscribed. For instance, `ordinals.plus/v1` context might be a JSON-LD context defining VerifiableCollectible, etc. It might be already hosted online, but for trust minimization it could also be on-chain. We should ensure the “ordinals.plus/v1” context content is accessible (maybe inscribed by the creators of the spec, or we do it).
    * **Visual/Document Resources:** such as images (collection logos, artist avatar) or PDFs (terms of service, license text). If an artist wants to attach a license document to their DID so that all their works reference it, we can inscribe that doc once.
    * **Governance Frameworks:** possibly not immediate, but per spec we might allow linking a governance document (for DAO or collective associated with a DID).
    * **Status Lists:** If we implement credential revocation/status lists, those lists (often a bitfield or list of revoked IDs) can be inscribed as a resource associated with the issuer DID. This aligns with spec listing “Status Lists”. We note this for future, but design should allow it.
    * **Configuration Documents:** any other JSON config the DID owner wants to share (for example, metadata about themselves beyond DID Doc).
  * The platform should have a general **“Add Resource to DID”** function, where the user selects a DID they control, uploads content, and we inscribe it. We must show the cost (each resource is an inscription).
  * The metadata for the resource inscription:

    * Content is the file itself.
    * We might also include a small metadata JSON (as CBOR) describing the resource (like a mini DID Document for the resource?). However, the spec suggests that adding `/info` and `/meta` to the DID URL yields info and metadata. Possibly:

      * `/info` for a resource returns structured info (content type, size, timestamp). Our resolver can supply that, likely from indexer data and from our knowledge (or if we include that as part of inscription).
      * `/meta` for a resource returns metadata if the resource itself had some (like a credential or a VP attached). For images, maybe no metadata unless we sign the image with a credential too.
    * Actually spec says *resources include metadata that can be signed using DID verification methods*. This implies that for each resource, we could attach a small verifiable metadata as well (like a mini credential saying “this resource is official and created by X DID”). This may be optional. We might not implement signing each resource in Phase 2 to keep scope manageable, but the architecture should allow it. For now, we rely on the fact that if the resource is inscribed on the same DID’s satoshi, that is already implicitly “authorized” by the DID owner (since only they could inscribe it). Verifiers can check that the resource inscription came after the DID Document inscription and presumably by same controller.
    * If simple, we might sign a hash of the resource with the DID’s key and include that signature in a metadata field. However, not prioritizing if time is short.

* **Resource Retrieval:** Users and systems must be able to retrieve linked resources easily:

  * The platform’s backend will implement resolution such that a DID URL with an index returns the resource content. For example, `did:btco:X/4` returns the raw content of resource at index 4 (like the actual image bytes).
  * We will provide front-end links or API calls to fetch these. On a DID management page, list resources with their indexes, types, and perhaps a download/view button.
  * As mentioned, `.../info` yields a JSON with details. We’ll design this format likely according to spec (fields might be like `{"contentType": "image/png", "contentLength": 15300, "timestamp": "...", "index": 4}`).
  * The system will utilize an ordinals indexer to get content if we don’t store it. Since storing images on chain can be fetched on-demand from a Bitcoin node or a caching service, we might not duplicate storage, just fetch as needed.
  * Ensure the UI references these nicely. E.g., for a collection DID, show a section “Linked Resources: \[Logo.png] (click to view), \[Schema.json]”.

* **Ensuring Immutability and Authenticity:** All linked resources are inscribed on Bitcoin, hence immutable by nature (one can supersede by inscribing new version, but the old remains). Authenticity is ensured by:

  * The fact that only the DID controller could have inscribed on that same satoshi (because they control the UTXO). This is a crucial security concept: *because the satoshi is the anchor, having an inscription on the same satoshi means the same owner*. Verifiers can confirm that the resource inscription’s sat number matches the DID’s, and likely assume the DID owner made it. (There is a nuance: if an attacker observed the satoshi and quickly inscribed something before the rightful owner, but if the owner holds the UTXO, no one else can inscribe on it without transferring it. So it’s secure.)
  * Additionally, if we include an explicit signature or reference from the DID Document, that adds a layer. Possibly the DID Document could list allowed resources and their hashes, but we probably won’t implement that now. Instead, we rely on ordinal provenance.
  * Nonetheless, we will abide by the spec’s suggestion for cryptographic verification of resources. If easy, we can issue a *verifiable credential as metadata* for each resource. For example, when inscribing a schema file, concurrently issue a credential stating “Resource with hash X of type schema is linked to DID Y” signed by DID Y. That credential could be the `/meta` of that resource inscription. This might be straightforward since we already have credential issuance logic. However, mindful of scope, we can leave formal resource credentials as a future improvement unless needed for security.

* **Resource Versioning:** If a resource needs updating, the spec supports version linking. For example, if a schema evolves, the user can inscribe a new version and perhaps mark the old as superseded. We should:

  * Provide maybe a note that resources are permanent and new version would get a new index. Our UI could label resources with version numbers if we implement a scheme (like an incrementing version in metadata or just by chronological order).
  * Not deeply implement linking between versions in Phase 2, but keep the possibility open. The DID Linked Resources spec likely suggests using a “nextVersionId” or similar references; that might be more relevant to DID Documents themselves or to a resource index being a chronological pointer. We at least output `versionId` and `nextVersionId` for DID resolution as per spec.

* **Resource Types and Usage Examples:**

  * *Credential Schema:* We anticipate needing to define the schema for our verifiable credentials (especially if custom fields). We will likely embed the JSON-LD context in each credential (via URI), but hosting it on-chain as well provides permanence. We can inscribe the `ordinals.plus/v1` context JSON as a resource on a “schema DID” (maybe the Ordinals Plus team’s DID or we create a generic DID for schemas).

    * If we do that, our credentials could reference `did:btco:<schemaSat>/<idx>` as their `@context` instead of an HTTP URL, enabling fully offline verification. However, JSON-LD processors might not support did: URIs as contexts directly. Alternatively, we include the context verbatim in each credential (which is done by including the ordinals.plus context URI which the verifier might fetch from web or a cached copy).
    * This is more of an ecosystem concern; for now referencing their official URL might suffice, but we note this as a possible future resource to add.
  * *Curated Collection Manifest:* Although the credential itself lists items, sometimes a curator might want a separate resource file listing the collection in plaintext or providing additional info (like a web page or PDF catalog). They could inscribe that and link it.
  * *Ownership Proofs:* In future, an owner could inscribe a “proof of ownership” resource (like a signed statement that they own DID X at time Y). This could be used for example to prove holding of an asset without transferring it. It’s speculative, not required now, but our architecture with resources and DIDs would allow layering such features later.

* **Wallet/Client Impact:** Wallets or explorers that aim to support these features need to be aware that any inscription can be referenced as `did:btco:.../index`. We will likely need to coordinate or contribute to a reference implementation so that ecosystem tools adopt it. As part of our project (non-user-facing requirement), we might provide reference code or documentation for wallet devs (like Dana’s case). This ensures resources can be discovered outside our platform:

  * For example, if an explorer sees an inscription, it might check if there’s a DID Document in metadata. If yes, it could list linked resources by querying subsequent indices on that sat.
  * These are beyond direct functional requirements of our product but are consequences; we note them in documentation.

* **Limits and Validations:**

  * Enforce the \~190 KB limit per inscription for resources (spec highlight). If a user tries to inscribe something larger, our system should refuse or split it (splitting not trivial, better to just reject or downsize).
  * Validate file types for security: e.g., if allowing PDF or HTML, be cautious as these could contain scripts/malware (though on chain it’s inert, but if someone downloads it could be malicious). Possibly restrict to common safe types or scan them.
  * If linking a resource that is a **Verifiable Credential** (like one could link a VC as a resource separate from the main flow), ensure that verification works via the DID (the spec mentions if a VC or VP is at /meta, return as such). So if the user inscribed a VC as a standalone resource, our resolver should detect it and mark content type accordingly. This is an edge case; mostly our VCs are either metadata of an inscription or curated collection credentials.

## Technical Design & Architecture

This section outlines how the system will be architected to implement the above requirements. We describe the components, data flows, data models, and interactions with external systems (Bitcoin network and Aces API). The design follows a modular approach, separating concerns of *inscription management*, *DID/VC processing*, and *client UI*, with compliance to the Ordinals Plus specification at each layer.

### Architecture Overview

**Overall Architecture:** The platform can be viewed in three layers:

1. **Client Layer (Web App / UI):** Handles user input (inscription form, metadata form) and displays results (inscription details, verification status). It communicates with the server via RESTful API calls or WebSockets for updates (e.g., to know when an inscription transaction is confirmed).
2. **Application Server Layer:** Our backend that contains the core logic:

   * *Inscription Service:* Constructs and broadcasts transactions for inscriptions. It interfaces with a Bitcoin node or Ordinals library for the commit/reveal process.
   * *DID/VC Service:* Responsible for preparing verifiable credentials, calling the Aces API for issuance, and storing or embedding the results. Also handles DID resolution logic and linked resource management.
   * *Database:* Stores user data, references to inscriptions (e.g., mapping user -> inscription IDs), and metadata about DIDs and resources (for quick lookup rather than always scanning chain).
   * *Integration Modules:* e.g., Aces API client, Bitcoin RPC client (for UTXO management).
3. **External Systems:** Bitcoin network (and Ordinals indexer) and Aces service:

   * Bitcoin Ordinals require either running a Bitcoin full node with the ord indexing (such as the `ord` CLI index) or using a third-party API (like ordinals.com or an indexer). For trust minimization and full feature support (especially for DID resolution), we will run our own indexer.
   * Aces is an external web service; our server must authenticate and communicate over the internet with it.

**Data Storage Considerations:** Much of the data is on-chain, but we will store certain mappings:

* We will maintain a table of **Inscription Records**: containing inscription ID (which can be composed of \<txid\:output index> or an index number given by ordinals protocol), the satoshi number, the content type, and whether it has metadata (and what type). This helps us quickly find, e.g., “latest inscription on sat X” for DID resolution, or whether an inscription has a VC without scanning raw data each time.
* **DID Records:** For each DID created or known, store the sat number, current `versionIndex` (which inscription index is the latest DID Document), and possibly a reference to the controlling user (if user created it via our platform).
* **Resource Records:** For each DID resource, store DID, index, type, and perhaps a pointer to content (though content is on-chain, we might cache large files to avoid repeatedly downloading from Bitcoin).
* These DB records ensure performance; they will be kept updated by listening to events (when we inscribe, we insert records, and possibly by periodically syncing with a full node for external changes).

**Security Architecture:** Keys are a major component:

* If we generate keys for DIDs, those need secure storage. We might use an HSM or at least encrypted database fields for private keys. Alternatively, integrate with a custody service. As an MVP, storing in our DB encrypted with a master key is possible, but we should plan to allow user-side key management in future.
* API secrets for Aces etc., similarly stored securely.

### Data Flow Diagrams

*The following outlines key flows in a step-by-step manner (pseudocode and descriptions) to illustrate how data moves through the system.*

**Flow 1: Inscription with Verifiable Metadata (Creator user story)**

1. **User Initiates Inscription:** Carol fills out the inscription form on the web UI with:

   * Content: e.g. uploads `art.png` (the file to inscribe).
   * Metadata: enters Title “Sunset #1”, Description “First in series”, selects “Creator DID” as Carol’s DID (or chooses to create one if none).
   * Toggles “Include Authenticity Certificate” = Yes (this triggers VC flow).
   * Clicks “Inscribe”.

2. **Client-Side Validation:** The UI checks required fields (Title not empty, file present, etc.), then sends an API request to backend: `POST /inscriptions` with JSON including metadata and perhaps an ID pointing to the uploaded file (the file might have been pre-uploaded or sent as form-data).

3. **Backend Receives Request:** The Inscription Service processes the request:

   * Saves the file if not already (maybe to a temporary store awaiting inclusion in transaction).
   * Locks some UTXOs for use (if the platform is custodying some funding UTXOs or instructs the user’s wallet, depending on model; let’s assume platform can manage a funding UTXO from user’s account).
   * Calls DID/VC Service to *prepare credential data*.

4. **Prepare Credential Data:** In DID/VC service:

   * Determine subject DID: If “create new DID for this inscription”:

     * Pick the satoshi to inscribe on. Typically, when inscribing, one can let the ordinals system choose the first sat of the output. But for control, we might want to choose a specific rare sat or one user owns. Likely we don’t give a choice and just use the next available sat from the funding input (which might not be deterministic though). Alternatively, user might specify a sat (advanced usage). For now, we will get the satoshi number after the commit transaction is constructed (the ordinals tool can tell us which sat was allocated to the inscription).
     * Since we need the DID for credential before broadcasting, we might have to *reserve* a sat or compute which sat will carry the inscription. If using ord client, it usually picks the first input’s first sat or something for the inscription. We could ensure a known UTXO with a known sat used. This is a complex area; but we may proceed by constructing a dummy reveal and extracting sat number at this stage.
     * Once sat is determined (say satNumber = S), set subject DID = `did:btco:S/0` (assuming it will be the first inscription on that sat).
     * If Carol selected an existing DID for issuer, use that; otherwise if she opted to create, then issuer DID = `did:btco:S` as well (meaning the item’s DID doubles as issuer? That would mean the item signs its own credential, which doesn’t make sense unless item and creator are same – not usually, the creator would have a different DID). Actually if Carol has no DID, likely we use platform issuer. If she wanted a DID but doesn’t have one, perhaps the system is creating *two* DIDs: one for the item and one for Carol. That’s heavy. Instead, easier: use platform as issuer in that case.
     * Let’s assume Carol’s DID exists or platform. We set issuer DID accordingly.
   * Populate credential JSON:

     * `@context`: `["https://www.w3.org/ns/credentials/v2", "https://ordinals.plus/v1"]`
     * `type`: `["VerifiableCredential", "VerifiableCollectible"]`
     * `issuer.id`: Carol’s DID (e.g. did\:btco\:CarolSat) or platform DID.
     * `credentialSubject`:

       * `id`: `did:btco:S/0`
       * `type`: `"Collectible"` (from ordinals.plus context, perhaps it defines this type)
       * `title`: "Sunset #1"
       * `description`: "First in series"
       * `creator`: Carol’s DID (even if issuer is platform, we put Carol’s DID here to acknowledge authorship).
       * `creationDate`: "2025-05-13" (today’s date).
       * `properties`: object with `medium`, `format`, `dimensions`:

         * `medium`: "Digital" (we might default to "Digital" for all ordinals).
         * `format`: "image/png" (obtained from file MIME).
         * `dimensions`: "1024x1024" (if we can get image size; if not, this can be omitted or filled with “N/A”).
       * `rights` (optional): If Carol provided license info, include it (e.g., license "CC BY-SA 4.0").
       * `attributes` (optional): any extra attributes Carol added (e.g., {"series": 1, "theme": "Sunset"}).
     * `issuanceDate`: now timestamp.
     * No `proof` yet.
   * If *creating a DID Document for the asset*: Also generate keys for the DID:

     * Generate an Ed25519 key pair (private\_key\_sk, public\_key\_pk).
     * Form DID Document JSON with context, id: `did:btco:S`, verificationMethod: `[ {id: "did:btco:S/0#key-1", type: "Multikey", controller: "did:btco:S", publicKeyMultibase: <encoded pk> } ]`, authentication: \[ "#key-1" ]. (We use Multikey type as per spec for flexible key format).
     * The DID Document will be encoded later as CBOR for embedding.
     * Store the private key (associate with user if this DID is under their control).
   * Prepare to call Aces:

     * The credential JSON (without proof) and the issuer’s DID and key information are ready. If issuer is Carol’s DID and we have her key (like just generated, or stored from before), we might sign ourselves and skip Aces for issuance – but standard flow is to use Aces.
     * Construct Aces API request payload: could include the credential JSON and maybe a DID or key identifier for signing. Perhaps Aces has an endpoint like `/issueCredential` that expects:

       * `template` or `credential` object,
       * `verificationMethod` or `issuerDID` to know which key to use (Aces might have multiple keys registered).
       * We will have pre-registered the platform DID’s key with Aces if using platform DID. If using Carol’s DID and Carol’s key is generated now, Aces doesn’t know it. We might in this moment call an Aces endpoint to register a new key or DID (if Aces supports dynamic keys). Alternatively, sign locally in that case.
       * For simplicity, assume using platform DID for now: Aces already has the platform issuer key configured, so we just specify that.
     * Send request to Aces over HTTPS.

5. **Aces API Signing:** Aces service receives the request, uses its internal crypto to produce a `proof` on the credential:

   * It adds an appropriate `proof` object (e.g., `type: "DataIntegrityProof", cryptosuite: "ed25519-2020", created: "...", verificationMethod: "did:btco:PlatformDID#key-1", proofValue: "zSignature..."`).
   * Returns the complete credential JSON with `proof`.

6. **Back in DID/VC Service:** We receive the credential with proof. We quickly verify:

   * Use the issuer DID (platform’s DID) to fetch the public key (we have it, or resolve did\:btco\:Platform if it’s a DID too).
   * Check signature validity (to double-confirm Aces did it right). Assuming valid.
   * Now, we incorporate this credential into the inscription.
   * If we are doing a single inscription with content + metadata:

     * We need to embed two things: the image content and the metadata (DID Document + Credential).
     * Potential method: Create a single *commit transaction* that will yield an inscription with a combined payload:

       * If using ord’s convention: Normally, an inscription has a content type part and content bytes. Perhaps we can trick it by setting content type to `application/json` and content to a JSON that contains both? But then how to separate DID Doc vs VC?
       * Or treat the DID Document as a special metadata chunk and the VC as another? Possibly encode both into a CBOR structure. E.g., a CBOR map with two keys: `did_document` and `credential`, plus maybe `content_type` for the primary content and the content bytes.
       * The Ordinals Plus spec likely has a precise way. If not clearly defined, we might define that in our implementation: we’ll encode the DID Document and VC as CBOR metadata.
       * Another approach: The DID Document could itself list the credential as a linked resource; but that complicates resolution. Better to embed credential directly.
     * We will likely do: **Inscription content = the actual file**, **Inscription metadata = CBOR containing DID Document and Credential**.

       * The resolver then might allow `/meta` to retrieve the DID Document or the credential. Perhaps `.../0/meta` returning the DID Document specifically and maybe `.../0/info` containing references including credential? The spec example for meta returns DID Doc, but it also said if metadata is VC it returns as VC. But here we have two metadata objects. Perhaps they consider DID Document as one type of metadata and other things as linked resources.
       * Maybe we consider the credential as a linked resource at index 1 inherently. Alternatively, we could designate that the DID Document’s service or some field contains the credential.
     * For simplicity, we might actually decide: Do *two inscriptions*:

       1. Inscription 0: the artifact content with DID Document metadata in it (so `did:btco:S` is created, containing DID Doc).
       2. Inscription 1: the credential JSON as its own content on the same sat (with maybe a trivial metadata or none).

       * In this case, the credential is a DID Linked Resource to the DID.
       * But then how do we mark that it describes the artifact? Perhaps through its credentialSubject being did\:btco\:S/0, it inherently references inscription 0.
       * This approach aligns with DID Linked Resources concept: resource index 1 is the metadata credential. And resolution:

         * `did:btco:S/1` would fetch the credential (content type application/vc).
         * `did:btco:S/0` fetches the image.
         * `did:btco:S/0/meta` fetches DID Doc.
         * This is cleaner separation: DID Doc stays with first inscription, credential moves to second.
       * The downside: it requires two transactions (costlier, more complexity).
     * Since the spec explicitly said include DID Document as metadata in the inscription, we’ll follow that for DID Doc. It didn’t explicitly say how to handle a VC metadata about the content. Arguably the VC itself is a form of metadata too.
     * Possibly we combine DID Document and VC into one credential? Not likely.
   * **Design Decision:** Due to time and complexity, we might implement the simpler approach initially: **Single inscription**, content + combined metadata (DID Doc + VC). We will document that we are slightly extending the notion of inscription metadata to hold two structures. As long as our resolver knows how to separate them (e.g., maybe store in CBOR as an array \[didDoc, credential]).
   * The Inscription Service will then finalize preparing the Bitcoin transaction:

     * It crafts the necessary witness data for ordinals:

       * For content, include content type (e.g., `text/plain` or the actual image type `image/png`) and the file bytes.
       * For metadata, include a tag or scheme: The Ordinals Plus might define something like an OP\_COREBR (just speculation) to include CBOR data. If not, we might encode the CBOR as if it were the “content” of another section.
       * Possibly the ordinals community might introduce a standard way to include JSON metadata by a certain content type marker (like a multi-part inscription).
       * We might embed the CBOR as an additional chunk in the OP\_RETURN after the main content chunk.
     * Sign the transaction with user’s Bitcoin key (if user provided UTXO from their wallet, they would sign; if we custody, we sign).
     * Submit the transaction to Bitcoin network via our node RPC.

7. **Transaction Confirmation:** The system waits for the transaction to confirm (or at least to be seen in mempool and get an inscription ID assigned by ord). We retrieve the inscription ID or number from our indexer:

   * The indexer (ord) will index the new inscription. We can query it by the funding output or by txid.
   * Once confirmed, we update our DB records: create Inscription record (sat S, index 0, content type image/png, has DID = true).
   * If we did separate credential inscription (index 1), that would be another record (sat S, index 1, content type application/vc+json).
   * Mark Carol as owner of DID S in DID records, store DID Document (or at least the keys) in DB for quick access.

8. **Post-inscription user feedback:** The backend responds to Carol’s request (if waiting synchronous, though more likely we had a job and we poll):

   * If synchronous, once transaction is broadcast, we could return an immediate response with the preview of inscription (unconfirmed). Or we respond with “inscription in progress, id: X”.
   * Usually, ordinals may require waiting for one confirmation to be considered final. But we can show it as pending.
   * The UI then shows Carol her new inscription details page. Initially, it might show status “Pending confirmation…”. After a block or two, it will show “Confirmed at block N”.
   * The page displays the image, and below it, a section "Verifiable Metadata":

     * Title: Sunset #1
     * Description: First in series
     * Creator: did\:btco\:CarolSat (or Carol’s name, we can resolve that DID to maybe display a name if she set one in DID Doc as a service attribute).
     * Creation Date: 2025-05-13
     * Format: image/png
     * etc.
     * Each of these might have a checkmark or some indicator that they are part of a verified credential. Perhaps a message “All metadata claims cryptographically verified.”.
   * We accomplish verification by resolving did\:btco\:S (the content’s DID):

     * Get DID Document (with keys), get the VC (if not already known), then verify signature.
     * We probably already trust it since we made it, but we do the procedure to confirm no corruption.
   * Carol can also see “DID: did\:btco\:S” on the page. If she clicks it, maybe we show the raw DID Document in a JSON viewer (for advanced users).
   * If Carol created a new DID for herself as issuer, that DID might also now appear in her profile with some metadata (like she could add a display name off-chain or something).
   * Everything is logged and audit-trailed.

**Flow 2: Verifying an Inscription’s Credential (Collector user story)**

This flow happens either on our platform (user clicking verify) or externally. We’ll describe an internal verify:

1. Colin enters the inscription ID or scans a QR code that includes the DID perhaps.
2. The UI calls GET `/inscriptions/{id}/verify` (for example).
3. The backend lookup the inscription:

   * Find sat and index from DB or via indexer.
   * Determine if it has verifiable metadata (flag in DB). If not, return “No verifiable metadata attached” result.
   * If yes, retrieve the credential:

     * If we stored the credential JSON in DB when created (we might have since we had it in memory), we can use that.
     * To be safe (and truly trustless), the verify process might ignore the DB and do fresh:

       * Resolve the DID of the credential’s issuer to get current public keys.
       * Fetch the credential either from DB, or reconstruct from chain: perhaps call our DID resolver for `did:btco:S/index` if we separated it, or parse the inscription’s metadata if combined.
   * Perform cryptographic verification:

     * Check the credential’s `issuer.id`. Resolve it via DID resolution (which may involve querying ordinals index for that DID’s latest DID Doc).

       * Confirm the DID Document is retrieved and contains the verificationMethod that matches the credential’s proof’s verificationMethod.
       * Check that the DID Document is not revoked (we’d see if maybe a deactivation inscription exists; out of scope unless we implement).
     * Use a VC verification library (or our code) to verify the signature on the credential (DataIntegrityProof verification with the obtained public key).
     * Validate credential fields against expected schema rules:

       * e.g., ensure `credentialSubject.id` equals the inscription’s DID (it should).
       * ensure the content’s properties like format/dimensions match what we know about the actual inscription content (we can cross-check content length or hash if we included it).
       * If any rule fails, mark verification as failed (e.g., if someone tampered or if content changed, etc.).
   * Prepare a verification result object (valid/invalid, details).
4. API returns verification result. The UI then shows appropriate message:

   * If valid: show green check and details as described in Colin’s acceptance.
   * If not: red cross with reason. Possibly instruct user to be cautious if it failed.
5. If Colin is using a third-party wallet, they’d do similar steps using our open spec. For instance, Xverse wallet could incorporate the DID method and check the `ordinals.plus/v1` context logic to verify.

**Flow 3: Curated Collection Creation (Curator user story)**

1. Caleb selects multiple inscription IDs from a list in the UI (or inputs them).
2. Inputs collection name & description.
3. Chooses an issuer DID for the collection credential (likely his DID representing the curator identity).
4. Hits “Create Collection”.
5. Backend compiles a Curated Collection credential:

   * Contexts: VC and ordinals.plus.
   * Type: `["VerifiableCredential", "CuratedCollection"]`.
   * Issuer: Caleb’s DID.
   * credentialSubject: Could be the collection itself – but in this model, the “subject” might be a conceptual entity (like the collection DID if we have one). Alternatively, some credentials use a different approach: since the VC describes a set of items, it might not use `credentialSubject.id` in the same way. However, maybe the subject could be a DID for the collection. If we treat the collection as an entity, we might have created a DID for the collection (Caleb could designate one of his sats as the collection ID).
   * Claims: include collection name, description, and an `items` array listing each inscription’s DID URL.
   * Possibly include a field for category, theme, etc if provided.
   * issuanceDate = now.
6. Call Aces to sign it (issuer DID = Caleb’s DID if Caleb’s keys known; if not, possibly platform signs on Caleb’s behalf or Caleb’s DID’s key is in our custody).
7. Aces returns signed collection VC.
8. Inscribe this VC to Bitcoin:

   * We definitely treat this as a *standalone inscription*, content type likely `application/vc+json` (or `text/plain` but JSON content).
   * The satoshi to use:

     * Could use one of Caleb’s sats (maybe the DID he has) or a new sat. Ideally, if the collection has a DID, use that sat. If not, we might inscribe on a new random sat (less ideal because then the collection doesn’t have a stable DID).
     * Better: We prompt or automatically use Caleb’s curator DID (if he has one) as the collection anchor. For example, if Caleb’s DID is did\:btco:1234 (from an earlier identity inscription), we inscribe this credential on sat 1234 as a new linked resource (index maybe 1 or next).
     * That way, the collection is linked to Caleb’s identity DID.
     * Alternatively, treat the collection as its own DID: assign a new sat as collection ID, inscribe the VC on index 0 along with a DID Doc for the collection. But that may be overkill if we can just link to curator’s DID.
   * We choose an approach: If Caleb has a DID for his organization, store the collection VC as `did:btco:CalebSat/n`. If not, we generate a new DID specifically for the collection (like did\:btco\:CollectionSat).

     * This could even be user’s choice “Use existing DID or create new for collection?”.
   * After deciding, Inscription Service creates and broadcasts the transaction with the collection VC JSON.
9. Update records: mark those inscription DIDs as members of this collection (so we can quickly query from an item which collections it’s in, if any). Also record the collection credential’s location (sat and index).
10. UI confirms to Caleb with a page for the Collection:

    * It has an identifier (the DID or at least the inscription ID of the credential).
    * Shows name, description, and the list of items (each as a link).
    * Shows issuer = his DID, and verification status = valid (we verify similarly).
    * Now, any item’s page that is in this collection can show a reference or badge.

**Flow 4: Adding a Linked Resource to a DID**

1. User goes to their DID management page (or collection page) and chooses “Add Resource”.
2. Upload file (e.g., `logo.png`).
3. Select resource type if needed (we can auto-detect from file, but maybe a label).
4. Backend receives and inscribes on the chosen DID’s sat:

   * Determine next available inscription index on that sat. If using our own indexer DB, we know last index. If not, we fetch the list of inscriptions on that sat (ord indexer gives the count).
   * Create transaction using that satoshi (the user must still own the UTXO). If our system initially inscribed that DID and kept the UTXO, we have control. If user moved it, we’d need to detect that and prompt them to send it back or sign a tx from them (complicated).
   * For now, assume the DID sat is in our custody or user’s linked wallet for this purpose. We create a transaction sending that sat to another output with the resource data in witness, similar to normal inscription.
   * The content is the file bytes, content type accordingly.
   * Optionally, we can include a metadata JSON in the inscription that says e.g. `{ "resourceType": "logo", "name": "Collection Logo" }`. But the spec tends to rely on external resolution for info, so might not need if we provide `info` via API.
5. Confirm and update DB: new Resource record with DID, index, contentType etc.
6. The DID Document might not automatically list this (maybe not needed because DID-URL addressing is how to find it). If we wanted, we could update the DID Document with a new version that includes a service entry referencing the resource. That would require reinscription of DID Document (which would increment index and complicate things). Instead, the DID Linked Resources spec suggests you don’t need to alter DID Doc; you discover resources by querying indices or some known indexing.
7. UI informs success. The collection page now might show the image (fetched via did\:btco:.../n).

   * If the resource is a schema JSON, we might not show content but just list its name and maybe a link to download.

### System Components and APIs

We design specific components:

* **Ordinal Inscription Module:** likely using an external library (like the `ord` CLI through subprocess, or a direct indexer library such as ordinals-api or writing custom to create inscriptions). This handles forming the witness data for inscriptions and broadcasting. AI-assisted development will help integrate these tricky parts (maybe by referencing how ord does it).
* **DID Resolver Module:** Implements did\:btco resolution. It will interface with our indexer database or directly with `ord` index files to find inscriptions on a sat. It will decode CBOR metadata to JSON. We might implement it as a library function `resolveBtcoDid(did: string) -> didDocument, metadata`.
* **VC Verification Module:** We’ll likely use a library (perhaps a JS library like `jsonld-signatures` or a Python one if backend in Python) for verifying VC proofs. However, since the keys are from our DID method, we may need to plug in a custom verification method (if using JSON-LD lib, we add our DID resolver to it).
* **Aces API Client:** A simple HTTP client wrapper to call Aces endpoints with proper auth headers, and handle retries or rate limits if needed.
* **Web Hooks / Async Handling:** Optionally, if Aces could call back or if we do some tasks asynchronously (like waiting for Bitcoin confirmation), we might use asynchronous jobs (like a queue). E.g., after broadcasting tx, schedule a check job to update status. With AI assistance, we can scaffold such job handling code quickly.

**Structural Diagram (Conceptual):**

*(In absence of an actual image diagram, the structure can be described in text form:)*

* **User Interface** (Web/Wallet)
  ↕ (HTTP/JSON)
* **Backend Server**
  • *Controller/Endpoint Layer* – (e.g., InscriptionController handles `/inscriptions` POST)
  • *Services:*

  * InscriptionService (handles UTXOs, transaction building)
  * DIDService (handles DID creation, resolution logic)
  * VCService (handles credential creation, calls Aces, verification)
  * ResourceService (handles linked resource ops)
    • *Integrations:*
  * BitcoinNodeClient (RPC or CLI calls to craft & broadcast transactions)
  * OrdinalsIndexer (database or in-memory index of inscriptions by satoshi)
  * AcesClient (HTTP client for VC API)
    • *Database:* (Inscription records, DID records, etc. as described)
* **External:**

  * Bitcoin Full Node + Ordinals Indexer (to retrieve inscription content by sat or by inscribe new ones)
  * Aces VC Service (to issue credentials)

The *Technical Architecture* ensures a separation: e.g., if Aces is down, we could theoretically swap to another VC service or local signing by toggling the VCService implementation, without changing InscriptionService.

### Data Models

We define key data structures in simplified form:

* **InscriptionRecord:** `{id: string (txid:index or custom id), satoshi: string, contentType: string, hasMetadata: bool, timestamp, ownerAddress, did: string (if a DID Document is present in metadata)}`.
* **DIDRecord:** `{did: string (did:btco:<sat>), controllerUser: userId?, currentIndex: int, createdBlock, deactivated: bool, note: text}`.
* **ResourceRecord:** `{did: string, index: int, type: string (e.g., "image/png"), title: string (optional label), txid: string}`.
* **User:** might have fields for linked DIDs or keys if any.
* **CredentialRecord:** (maybe store issued credentials for reference) `{id: string (could be same as inscription id or an internal uuid), didSubject: string, issuerDid: string, type: "Collectible"|"Collection", data: JSON, status: "valid"|"revoked"}`.

We might not store full credential JSON if we can always derive it from chain or input, but storing can make some queries easier (e.g., listing all collection items from the credential data instead of scanning each inscription for mention).

### Non-Functional Aspects in Design

* **Performance:** The heavy operations are signing transactions (quick), calling Aces (network latency), and Bitcoin I/O (waiting for block confirmation). We will utilize concurrency where possible:

  * We could prepare the VC while simultaneously preparing the Bitcoin transaction (they're somewhat sequential because we need VC ready to embed). But maybe we can build the tx template and only insert the final proof at last minute.
  * Verification of credentials is cryptographically heavy (JSON-LD can be slow). Caching DID Documents and verifying proofs with efficient libraries will be important. We might use in-memory cache for DID resolution results to avoid scanning the chain repeatedly (especially for known DIDs like platform DID).
  * Bulk operations (like if verifying a whole collection) could be optimized by reusing previously resolved DIDs and contexts.
* **Scalability:** If usage grows (e.g., thousands of inscriptions with metadata daily), the components should scale horizontally. The stateless nature of VC verification and DID resolution (backed by our DB or node) allows multiple app servers to run. The Bitcoin node/indexer might need tuning but can handle read queries for DID resolution pretty well.
* **AI Assistance in Development:** We plan to use AI coding tools to expedite writing boilerplate for these modules. For instance:

  * Generating data model classes and serialization (AI can quickly produce code for our records).
  * Integrating with ordinals CLI: the commands to inscribe content with extra metadata can be trial-and-error; AI can help by synthesizing from docs how to include additional data in an inscription transaction.
  * Writing the DID resolution logic (parsing binary inscription data into JSON) might be eased by AI, given the specification as input.
  * Testing: we can have AI generate unit tests for verifying that a known VC JSON verifies correctly with a known DID Doc – speeding up our QA.

### Example: Inscription Transaction Structure

To illustrate how an inscription with DID and metadata might be serialized (based on spec understanding):

* The witness data might look like:
  `[signature] [public key] 0x00 0x01 ("ord") 0x01 (content tag) "image/png" 0x00 [image bytes] 0x01 (metadata tag perhaps) "application/cbor" 0x00 [CBOR bytes] 0x00`
  (This is hypothetical, exact format to be determined by ordinals protocol extension.)

  The CBOR bytes would contain a map like:
  `{ "didDocument": <DIDDoc JSON>, "verifiableCredential": <VC JSON> }`
  compressed as CBOR. This way both are stored. Our DID resolver then knows to return DIDDoc for `/meta`. And for the VC, since it is also present, maybe our API specifically fetches it out. Possibly we won't advertise it via DID URL directly, but our platform knows it's there.

Alternatively, two outputs could be used: one for content, one for metadata, but ordinal protocol normally uses one output for the inscription.

Given the novelty, we will iterate on that during implementation. The requirement is that **no critical data (DID Doc or VC) is solely off-chain; all must be on Bitcoin either directly or by reference to an on-chain DID.**

## Non-Functional Requirements

### Security

* **Cryptographic Security:** All verifications (DID resolution, VC signature checks) must be implemented following best practices. This means validating *every* cryptographic aspect:

  * The VC’s proof signature must be checked against the correct public key (with correct hash/encoding). Use known libraries to avoid mistakes.
  * Ensure the DID Document’s authenticity by relying on the blockchain (only accept DID Documents that come from our own node or a trusted source). Since the DID Document isn’t signed, the trust is from the fact it’s on Bitcoin. We will only retrieve DID Documents via our own full node or a highly trusted indexer to avoid any tampering.
  * Enforce that the **issuer’s DID is controlled by issuer** – i.e., if platform is issuing on behalf of user’s DID, ensure we had authorization. Ideally, we avoid that scenario by either having keys or not claiming it’s from user if they didn’t sign.
  * Implement the spec’s security considerations such as checking that *issuer DID control is proven* (the spec likely means that if a credential says issuer is did\:btco\:X, then the proof’s verificationMethod should reside in did\:btco\:X’s DID Document, establishing control).

* **Key Management:** Private keys used for signing (whether platform’s or user’s DID keys stored with us) must be protected:

  * They should be stored encrypted at rest. Access to them should be limited to the process that needs to sign (e.g., only the VCService).
  * If possible, integrate hardware security module or at least separate microservice that handles signing, so the keys are not all in main app memory.
  * Regular key rotation for the platform’s issuer DID is recommended. We might set a schedule to generate a new key pair for Aces DID every X months and update the DID Document via inscription (ensuring the old one remains until not needed). This might be future consideration but keep in mind.
  * The system should never log or transmit private keys. When calling Aces, if Aces holds keys internally, that’s fine; if we send a private key to Aces (not ideal), that’s a huge risk. We intend not to send raw keys anywhere; Aces should have its own keys or be pre-loaded with our platform key.

* **Authentication & Authorization:** Only authorized actions allowed:

  * Only the user who owns an inscription or DID can add resources to it or update it via our platform. We’ll enforce checks in endpoints. E.g., if user tries to add resource to a DID they don’t control, deny.
  * If multi-user, ensure one user can’t tamper with another’s metadata or credentials via the API.
  * The Aces API credentials must be stored securely and not exposed in front-end. The calls to Aces are made server-side.

* **Privacy Considerations:**

  * **Personal Data Minimization:** We will encourage that credentials do not contain unnecessary personal data. Our default fields (title, description of art) are not sensitive. If users want to, say, include their real name or location as part of an identity credential, that’s their choice, but we’ll caution them that *everything inscribed is public and permanent*.
  * The system itself will not leak user personal data; we don’t even plan to store much PII except maybe username/email for account, which stays in our DB and not on-chain.
  * **Correlation Risks:** Using DIDs could correlate a user’s multiple works. If Carol uses the same DID for all her art, observers know all those pieces are by the same entity (which might be desired for brand, but it is correlation). If Carol wanted pseudonymity per piece, she could use distinct DIDs. We should allow that choice (maybe advanced: “Use a new DID for each piece” vs “Use one DID for all my works”). Document in help that using one DID across works links them together publicly.
  * **On-chain Footprint:** We consider if any data could compromise privacy inadvertently (e.g., a credential might include a reference to an off-chain URL that reveals something). We will sanitize and make sure we only include what is needed and user-approved.
  * **Selective Disclosure:** Not in this phase, but VC 2.0 supports selective disclosure (BBS+ signatures, etc.). We are not implementing that now, but our design of credentials should not preclude it later. For instance, if in future a collector wants to prove ownership without revealing which piece, etc., that’s complex but somewhat doable with ZK proofs. We note it but not implement now.

* **Usability:**

  * Despite the complex tech (DIDs, VCs), the user experience must remain *simple and intuitive*. We will achieve this through careful UI/UX design:

    * Use friendly language: e.g., say "Digital Certificate of Authenticity" instead of "Verifiable Credential" where appropriate, to non-technical users.
    * Provide tooltips or help modals explaining benefits (“This adds an authenticity certificate that others can verify. It’s like signing your artwork.”).
    * Ensure that if a user opts out of these features, they are not overwhelmed by forms – keep the default path easy.
    * Ensure metadata input form is not too long. Perhaps hide advanced fields under an accordion (“Additional attributes”) to avoid scaring casual users.
    * For DID management, possibly keep it behind an "Advanced" section.
  * The latency introduced by these features (calls to Aces, etc.) should be minimized to keep the process feeling responsive. We aim for the entire inscribe process to complete in, say, under 10 seconds excluding blockchain confirmation. AI assistance can help streamline code for performance but we will likely also need to optimize network calls (maybe parallelize UTXO fetching with credential issuance).
  * Provide feedback at each step (progress bar or loading states like “Issuing credential…”, then “Writing to Bitcoin…”, etc.).
  * In verification flows, present results clearly (green check marks, issuer identity names if known, etc.). If something is unverified, use clear language (“Signature invalid – the certificate may be tampered or the issuer’s key is unrecognized.”).

* **Performance:**

  * While typical usage might be one inscription at a time per user, the system should handle bursts (e.g., an artist might batch mint 20 pieces with metadata). The Aces API and our node calls might be the bottlenecks:

    * We might implement queueing to not overload Aces with simultaneous requests – e.g., process them sequentially if needed.
    * For Bitcoin, creating many transactions quickly can be done, but if we rely on a single ordinal service, it could be serial due to UTXO locks. We may need to prepare multiple UTXOs for parallel inscribes.
  * Our DID resolution logic will be used often (every verification, every time someone views an item with DID). We will optimize by:

    * Caching DID Documents in memory or a fast store with an expiry or invalidation when a new inscription on that sat is detected.
    * Possibly pre-fetching popular DIDs (like if an artist’s DID is used in 100 credentials, cache it).
    * The DID documents and VCs are small (a few KB), so JSON processing is fine. Crypto signature verification is also quite fast (ms range) for Ed25519.
  * **Scalability**: Use asynchronous processing where appropriate. Inscription creation can be offloaded to a background worker while the user waits with feedback (the user doesn’t necessarily need the HTTP request open if we handle via websockets or periodic check).
  * Aim to ensure that adding these features doesn’t significantly degrade throughput – inscribing with or without metadata should have roughly the same throughput, just a small overhead for the API call.

* **Reliability:**

  * The system should handle partial failures gracefully (as discussed in error handling).
  * We should also consider *Bitcoin network issues*: if an inscription tx fails to broadcast or is evicted from mempool, the system should notify user and possibly allow retry (with new fee).
  * If Aces is down, perhaps allow user to proceed inscribing without VC, and maybe queue the credential issuance for later insertion (though inserting later on-chain isn’t straightforward). More likely, if Aces down we put up a maintenance message that verifiable metadata is temporarily unavailable.
  * Monitoring: We will monitor success rates of credential issuance and have alerts for failures so we can respond quickly if an integration breaks.

* **Interoperability:**

  * Because we strictly adhere to standards (DID core, VC DM, Ordinals Plus), our outputs should be interoperable. We will test with:

    * Standard DID resolution tools (if any support did\:btco yet, maybe not widely as it’s new, but the spec being part of DIF means hopefully soon).
    * Standard VC validators (e.g., the W3C VC Debugger tool, if updated for VC 2.0).
    * At least ensure that the JSON-LD context `ordinals.plus/v1` is accessible or cached such that third-party JSON-LD processors can resolve terms like “VerifiableCollectible”.
  * We will publish documentation or open API specs for our DID resolution endpoints, contributing to the Ordinals Plus community.
  * *Wallet requirements:* (From the user’s prompt perspective) We note that wallets intending to support these features would need:

    * To be able to parse inscription content for metadata.
    * To implement did\:btco resolution. Possibly to integrate with a service (like ours) or run an ordinals indexer themselves.
    * Show the credentials in UI meaningfully.
    * Manage keys if users want to sign credentials themselves.
    * Our PRD doesn’t directly require building a wallet, but we ensure our platform’s design is wallet-friendly. For instance, if a user uses their own wallet to inscribe via PSBT, we have to embed the metadata before giving them the PSBT to sign. That means our flow should produce a PSBT that includes everything so their wallet just signs and broadcasts. We need to verify if popular wallets (like Xverse, Hiro) will preserve unknown witness data (they likely will if using PSBT fields properly).
    * In the future, possibly coordinate with wallet devs to adopt a UI for these, but for now, document how a wallet can detect an inscription carries a DID Document (like by content type `application/cbor` or a marker in script).

## Success Metrics

We will measure the success of Phase 2 by both qualitative and quantitative metrics:

* **Adoption Rate of Verifiable Metadata:** Track the percentage of new inscriptions created on our platform that include verifiable metadata. Our target is at least **50% adoption** within the first 3 months of release, growing to 70% if users find value. A higher rate indicates that users trust and find the feature beneficial enough to use regularly. We will gather this from our database (e.g., out of total inscriptions, count those with `hasMetadata=true`).

* **Number of DIDs Created:** Monitor how many BTCO DIDs are registered through our platform. This includes DIDs for individual inscriptions and user identities. A successful outcome is, for example, **100+ DIDs** created in the first month, indicating creators are embracing on-chain identities. Also, track repeats (one user using one DID for many vs. many DIDs).

* **Verifiable Credential Issuance Volume:** Count how many VCs are issued via Aces through this integration. Each inscription with metadata corresponds to at least one VC (collectible cred), plus any collection creds. E.g., target **200 VCs issued** in first month. We also ensure each issued VC is stored and can be verified; success means 0 undelivered or failed VC issuances for confirmed inscriptions (all or nearly all attempts succeed).

* **Verification Utilization and Accuracy:** Gauge how often verifications are performed (via our UI or API). For instance, if we provide a “Verify” button, count clicks or API calls. Success might be that **25% of inscription detail views include a verification action** – indicating users care to see the proof. Also track the **verification success rate**: ideally nearly 100% of attached credentials verify without error (a low failure rate means our implementation is correct and robust). Any verification failures should correspond only to actual tampering or expected cases (none in normal flow).

* **User Feedback & Satisfaction:** Through surveys or user interviews, evaluate user sentiment:

  * Do creators feel that adding verifiable metadata increased the value of their work or ease of selling? Aim for positive testimonials like “My piece sold for more because buyers saw it was verified.”
  * Do collectors say they trust inscriptions with the “verified” badge more? We can measure trust indirectly if possible (maybe marketplace behavior: verified pieces selling faster or at higher prices).
  * Aim for a satisfaction score (if surveyed) > 8/10 regarding the feature’s ease of use and utility.

* **System Performance Metrics:** Ensure that the new features do not degrade performance:

  * Inscription creation time: measure the end-to-end time from user clicking inscribe to transaction broadcast. Our goal is to keep this **< 10 seconds on average** with metadata (not counting confirmation). We can log timestamps at key points to compute averages.
  * DID resolution time: resolving a DID and returning a DID Document via our API should be fast. Target < 1 second for cached DIDs, < 3 seconds for non-cached (including a disk lookup of inscription content). We will test and measure this internally.
  * API reliability: no increase in error rate on our inscription or verify endpoints. We want 99%+ success on calls.

* **Security Metrics:** While harder to quantify, we consider:

  * Number of security incidents related to this feature (expect 0). E.g., any report of a vulnerability in DID/VC handling.
  * We could also set a metric “0 failed signature verifications in production issuance” meaning Aces always signs correctly and we never produce an invalid credential.

* **Compliance & Standards Recognition:** A more qualitative success metric is that the solution remains compliant as the specs evolve:

  * For example, if the Decentralized Identity Foundation (DIF) or W3C acknowledges our implementation or uses it as a reference, that’s success.
  * Or if other projects adopt the BTCO DID method because of our demonstrated usage.

* **Development Efficiency:** Since we mention AI-assisted development, we can measure development speed improvements:

  * Deliver Phase 2 in, say, **50% less time** than comparable projects (based on initial estimates), thanks to AI. We will keep track of how quickly we implemented features vs. plan. If we projected 8 weeks and deliver in 6, that’s a metric achieved.
  * Code quality metrics: e.g., maintain high test coverage (> 80%) while delivering faster – AI help should not reduce quality.

Finally, success will also be measured by the *broader impact*:

* If the presence of verifiable metadata and DIDs attracts new users to our platform (maybe see an uptick in signups or inscriptions coming from competitor platforms because we offer a unique feature).
* If marketplace or wallet partners integrate our verification (like “Verified Ordinals” badge using our spec), indicating ecosystem validation.

## Risks & Mitigation Strategies

Implementing cutting-edge DID and VC features on Bitcoin comes with several risks. We outline key risks and how we plan to mitigate them:

* **Risk: Specification Volatility** – The Ordinals Plus specifications (BTCO DID, Linked Resources, Verifiable Metadata v0.2.0 Draft) may evolve or change before finalization. This could make parts of our implementation incompatible or in need of rework if the spec changes (for example, if v0.3.0 introduces a different inscription metadata format).

  * *Mitigation:* We are building with modularity and configuration in mind. Where possible, we won’t hard-code magic constants that could change; instead, abstract them (e.g., if the context URL version updates, keep it configurable). We will actively follow the Ordinals Plus spec updates (monitor their GitHub). By participating in their community (perhaps via DIF channels or GitHub issues), we can anticipate changes. If a change is likely, we can implement with forward compatibility (e.g., support both old and new field names if easy).
  * We also plan for a thorough testing phase with the current draft, and if an update occurs, allocate time to adapt. The PRD and design will be updated if needed – flexibility is key.

* **Risk: Technical Complexity & Unknowns** – Combining Bitcoin script engineering (for inscriptions) with CBOR metadata and VC signing is complex and largely untested in the wild. We might face unexpected hurdles like: how exactly to embed CBOR without breaking ordinals parsing, or performance issues in JSON-LD handling.

  * *Mitigation:* We will schedule a *proof-of-concept spike* early in development to validate the hardest parts: e.g., create a dummy inscription with a DID Document and see if the ord indexer can still parse it. If ord’s current implementation ignores unknown sections, we might need to adjust. If we find that a single inscription can’t have two data payloads, we pivot to the two-inscription solution.
  * We’ll also use AI tools to search for any similar projects or discussions (maybe someone attempted ordinal metadata; AI might find references).
  * Having a backup plan (like the two-inscription approach for VC) ensures that if our preferred method fails, we can still meet the requirement by another means, albeit with maybe higher cost.
  * For JSON-LD complexities, we can mitigate by limiting usage (we might pre-process contexts and not do full expansion every time, etc.). In worst case, we can treat credentials as simple JSON objects to verify by extracting fields we need rather than full LD processing (since context mainly is for semantic, we know what fields we expect).

* **Risk: Aces API Dependency** – Our solution is dependent on the Aces service for credential issuance. If Aces has downtime, slow responses, or ceases to operate, our feature is crippled (can’t issue new credentials).

  * *Mitigation:* We will implement graceful degradation. If Aces is unreachable at the time of inscription, the user could be given the option to continue without the verifiable metadata (so the core functionality – inscribing content – still works). Additionally, we might implement a **retry mechanism**: queue the metadata issuance and try again later behind the scenes, then perhaps inscribe it as a separate resource.
  * We will also discuss internally about a local signing fallback. For instance, could we run a lightweight signing service or use libraries to sign the credential ourselves as a backup? This is plausible especially if using a known key (like platform’s DID key).
  * To mitigate performance issues, we’ll test Aces under load and possibly request rate limit info. If needed, throttle our requests.
  * We will maintain contact with the Aces team (if separate) to get advanced notice of any downtime.

* **Risk: Increased On-chain Fees and Storage** – By adding metadata, our inscriptions are larger, meaning higher Bitcoin transaction fees for users. If a credential JSON is, say, 2 KB and DID Document another 0.5 KB, plus an image of 50 KB, the total can approach 52.5 KB to inscribe. Fees might be substantially higher than a minimal inscription. This cost could deter users.

  * *Mitigation:* Optimize the size of metadata:

    * The credential and DID Document can be CBOR-compressed. CBOR is binary compact; we expect significant reduction compared to raw JSON (maybe 30-40% smaller).
    * Omit optional fields that user doesn’t fill instead of including empty placeholders.
    * We could consider using *shorthands* for context or common values to save space (though since it’s signable data, careful). Perhaps use context compression (JSON-LD allows terms, but that’s abstracted by context itself).
    * We can also educate users on the cost. Possibly provide a fee estimate that updates as they add metadata. For example, “Estimated fee: 20,000 sats (metadata adds \~5,000 sats to fee)”.
    * For extremely large images or metadata, consider recommending using a separate hosting. But since our USP is on-chain, we likely stick to on-chain. Still, for >100KB images, ordinals might not allow at all (there’s a limit \~100 KB per inscription due to consensus dust limits).
    * Also consider enabling batch processing to amortize costs (not straightforward since each inscription is separate).
  * If fees on Bitcoin spike (like heavy network usage), our users might pause usage. That’s external, but we can mitigate by possibly supporting **Lightning payment or sponsorship** (outside scope now).
  * We will test with typical sizes to ensure we don't inadvertently bloat things beyond limits.

* **Risk: User Error or Misuse** – Users might input incorrect data (typos in metadata, or attempt to claim a different creator’s DID as the creator, etc.). We need to ensure the system prevents or flags inconsistencies:

  * For example, a malicious user might try to use someone else’s DID as the `creator` field, to fake authenticity.
  * *Mitigation:* If a user selects a DID that they don’t own from a free text (we should not allow free text, rather present a dropdown of their DIDs or “Other”), we should warn that using a DID without proving control is not verifiable. Actually, if they try to use one not in their account, we should either block it or require them to prove they control it (e.g., by resolving it and seeing if a verification can be done, but controlling DID means controlling UTXO – tricky to verify in a web app).
  * Another misuse: someone might create a DID that mimics a famous artist by name (though did\:btco are just numbers, they can’t choose a readable name).
  * We should also anticipate that some might skip understanding and just random use. Providing clear guidance in UI (like tooltips next to each field explaining its purpose) mitigates confusion.
  * If the user enters extremely long text in description, the credential might become too large. We should set some reasonable limits on input length to keep credentials lean (and to avoid running out of ordinals size). E.g., description limit maybe 500 characters with warning about size.

* **Risk: Verification Complexity for Users** – If third-party support lags, users might find it hard to verify outside our platform, undermining the “trustless” aspect.

  * *Mitigation:* Provide easy verification tools (our site, plus maybe a command-line snippet in docs using open-source libs). Possibly collaborate with explorers like ordinals.com or others to incorporate our verification. If they don’t, at least ensure our site is accessible and maybe allow verifying any ordinal’s metadata (not just those created here) to support the ecosystem.
  * Internally measure and ensure that verification on our side is robust and catches any edge cases (like if someone manually crafted an inscription claiming to be a BTCO credential but signed wrongly, our verification should detect signature invalid).
  * The risk is moderate; even if others don’t adopt quickly, our platform’s verification is a strong start. Over time, success will drive adoption.

* **Risk: Wallet Compatibility** – If wallets or marketplaces don’t support these features, users might not get the full benefit (e.g., selling an ordinal on a marketplace that doesn’t show the metadata might negate the effort).

  * *Mitigation:* For now, our own platform will highlight it. In parallel, we can reach out to major ordinal wallets/markets to demonstrate the feature and provide integration docs. Perhaps as part of go-to-market, share that the Ordinals Plus standard is available and we implemented it.
  * We should also ensure nothing we do breaks normal wallet usage: e.g., if a wallet that doesn’t know about DID metadata tries to send the satoshi, it should still work fine (it will, as the metadata is passive). The presence of CBOR shouldn’t hinder transfer; ordinal tracking cares only that the sat is moved.
  * If any wallet filters inscriptions by content type, they might call ours unusual. We could tag the inscription content as the primary file’s type (so it appears as expected in wallets), and not worry if they ignore the hidden metadata.

* **Risk: Scalability and Cost on Our Infrastructure** – Running a Bitcoin node with indexing and handling possibly large data (images) could strain our resources.

  * *Mitigation:* Ensure we have sufficient server resources (disk for the Bitcoin chain + inscriptions, memory for index). Monitor memory usage of resolution service (some caching might blow up if not careful).
  * AI can help write efficient code, but we will also consider using streaming when handling large content to not load entire files into memory unnecessarily.
  * We might offload static content serving to a CDN if needed (e.g., once we have an inscription ID, we could fetch from a public gateway or a CloudFront caching our node’s output). But since trustless is key, we likely serve directly from our node to avoid a third-party.
  * If usage is small initially, no big issues; if it spikes, we have scaling plans ready (dockerize services, replicate as needed).

* **Risk: Regulatory Concerns** – Unlikely, but verifiable credentials sometimes raise questions about issuing credentials (like legally, issuing “certificates”). However, here it’s more akin to provenance certificates for art, which is not regulated. Unless someone tries to use it for identity info (like a DID that actually links to personal identity). We should ensure we do not accidentally step into regulated territory (like KYC or certificates that imply something legally binding). At this stage, it's all user-driven art metadata, so low risk.

* **Risk: User Lost Keys** – If we do allow users to have their own DID keys (and we don’t custody them), a user might lose the key. Then they can no longer issue new credentials from that DID or update DID Document. That’s not our system’s fault per se, but a user experience risk (they might blame system).

  * *Mitigation:* Emphasize when creating a DID for the user to securely back up their key (maybe show a mnemonic or download file). Provide guidance in help center on what to do if key lost (basically: can’t recover, maybe create new DID and re-issue things).
  * If we custody keys and we have an incident, that’s on us, so we lean towards custody for simplicity but then we bear responsibility to protect them (which we addressed under security).

* **Risk: On-Chain Permanent Mistakes** – If a user inscribes wrong data, it’s forever. If it’s metadata, they might ask to remove or change it. We cannot erase it. This could lead to user frustration.

  * *Mitigation:* Educate in UI (like a confirmation modal: “Your inscription and its metadata will be permanent and public. Please double-check the information.”).
  * Possibly implement a “re-issue corrected credential” feature: They could mark the old one as superseded by issuing a new one via another inscription, and maybe highlight the latest in our UI. The old incorrect one would still exist but could be marked in our database as outdated. That’s a process we can handle manually if needed or in future enhancements.

## Future Considerations

Looking beyond Phase 2, we foresee numerous opportunities to extend and improve the ordinals-inscription-flow with identity and credentials:

* **Credential Revocation & Status Lists:** In the current phase, once a VC is issued on-chain it cannot be revoked except by marking it in an external list. In the future, implementing a **revocation mechanism** will be important for flexibility (specifically mentioned in BTCO-VM spec). We plan to support **Status List 2021** or similar by using DID Linked Resources:

  * For example, inscribing a status list credential (a bit vector indicating which credentials are revoked) associated with an issuer DID. The `credentialStatus` field of each VC can point to that resource.
  * This would allow an issuer (like a curator or platform) to revoke a verifiable metadata credential if needed (say if a mistake or fraud is discovered).
  * Implementing this will require building UIs to mark credentials as revoked and updating verification logic to check status. It’s a complex but valuable addition to align with full VC lifecycle management.

* **Zero-Knowledge Proof Credentials:** As W3C VCs progress, privacy-preserving credentials using BBS+ signatures (for selective disclosure) might become standard. In a future phase, we could allow credentials that support proving certain attributes without revealing the entire credential. For instance, an artist could prove “I issued this” without revealing their entire identity, if needed. This aligns with advanced privacy but would require implementing different signature schemes and possibly off-chain proof generation (since on-chain everything is public, ZK is more for off-chain presentations).

* **Alternate Credential Types:** We introduced two credential types (Collectible and Collection). Future types could be:

  * **Identity Credentials:** If an artist wants to link their real-world identity or a pseudonym profile to their DID, they might inscribe a VC containing personal info or a biography, signed by themselves or even by a third-party attester. This could serve as a kind of artist verification badge (perhaps issued by the platform or a known authority).
  * **Achievement or Event Credentials:** E.g., if an inscription was featured in an exhibition, a credential could be issued to that effect.
  * These could enrich the narrative around assets and would use the same infrastructure we built (just different contexts and fields).

* **Integration with Wallet Standards (PSBT, etc.):** Currently, our focus is on our platform doing the inscription. In future, we might integrate with wallets so that users can initiate an inscription from their wallet app but still include our metadata:

  * For example, define a **PSBT extension** that carries the metadata. We could collaborate on a BIP for including extra data in an inscription PSBT that wallets can understand. This would truly decentralize the flow (user could create a VC in a wallet and inscribe directly).
  * It might be worthwhile to propose a standard to the Ordinals community for “inscription metadata” so that all ord wallets might support it in a consistent way.

* **Enhanced DID Document Features:** Future versions of the DID method could support:

  * **Authentication and Ownership Proofs:** e.g., enabling a challenge-response such that an owner can cryptographically prove control of a DID without doing an on-chain update (like signing a message with the DID’s key – this we already have by virtue of DID keys, so maybe provide UI to do that).
  * **Multi-key and Recovery:** The spec mentions key rotation and recovery. We might implement a scheme where a secondary key or some social recovery method is inscribed, in case the primary key is lost.
  * **Services in DID Document:** We currently might not use `service` property, but in future we can. For example, an artist’s DID Document could have a service pointing to their personal website or to an off-chain API that provides more data (like high-res images, etc.). Or a service for credential verification endpoint if needed.

* **Marketplace and Ecosystem Integration:** The ultimate goal is widespread adoption:

  * We will encourage marketplaces to display the Ordinals Plus metadata. Possibly create a browser plugin or an open-source component they can use to show a “Verified by Ordinals Plus” badge.
  * In future, our platform could evolve into a **registry** or aggregator for authentic ordinals. For instance, a user browsing might filter to only show inscriptions that have verifiable metadata (like a “verified collection” filter).
  * We might also integrate with search/discovery: use the metadata to categorize and search inscriptions (e.g., find all with Creator = X, or all with medium = Digital Painting).

* **Interoperability with Other DID Methods:** BTCO DIDs are specific to Bitcoin. In the broader SSI world, there are many DID methods (did\:ethr, did\:ion, did\:web, etc.). In future, bridging our ordinals identities with others could add value:

  * For instance, an artist might have a did\:ethr (Ethereum DID) they use elsewhere. We could support linking that to their did\:btco by perhaps having a credential or DID Document service linking them.
  * Or even a cross-chain verification: issuing a VC on Bitcoin that attests something about an Ethereum NFT or vice versa (beyond our current scope, but conceptually possible with multi-chain DID).

* **Scaling and Layer-2 Considerations:** Bitcoin mainnet is the gold standard for permanence, but cost and speed are issues. There are ideas like **Lightning Network** or sidechains (e.g., Stacks, Liquid) for NFTs:

  * Possibly in future phases, consider anchoring verifiable credentials in a more scalable way and only checkpointing to Bitcoin. For example, issue many credentials off-chain or on a sidechain, then periodically inscribe a summary on Bitcoin for auditability. This reduces cost but stays trust-minimized.
  * If Ordinals gets more congested, this might be necessary. However, that adds complexity and trust trade-offs. We’d monitor usage and costs to see if needed.

* **User Experience Improvements:** Once the core functionality is stable, we can iterate on UX:

  * For example, provide **pre-built templates** for metadata. An artist could select “Art NFT template” and it automatically sets fields like medium to Digital Art, rights to a default license, etc., to speed up input.
  * Provide **multi-inscription batch tool**: e.g., an artist can upload 10 files and one CSV of titles/descriptions, and the system issues all with metadata in one batch (maybe one after another behind the scenes). This would leverage our automated pipeline heavily.
  * Localization: providing the UI in multiple languages so that international users can use the features (especially if targeting global art market).

* **AI-assisted Features for Users:** We talked about AI for development, but could also integrate AI for users:

  * For instance, an AI could help fill in metadata (“Generate a description of this art piece” or “Suggest attributes/tags”). This could lower the barrier for creators to provide rich metadata.
  * Also for verification, an AI agent could scan the web or other blockchains to ensure uniqueness or check for copies (outside SSI though).

* **Continuous Alignment with Standards:** As W3C VC Data Model moves to Recommendation and new features (like Status List 2022 or Data Integrity v3, etc.), we will update our credential format. Similarly, if BTCO specs reach v1.0 with changes, we’ll upgrade. We will keep backward compatibility if possible (supporting our older credentials in verification). Potentially, write migration scripts if a significant change occurs (e.g., if context URL changes or DID format tweaks).

* **Community & Governance:** Because this system deals with authenticity, some governance might be needed:

  * Perhaps establishing a **web of trust** or known issuers. E.g., if platform Aces is a known issuer, its credentials carry weight; if some random user issues credentials, how to trust them? Currently, trust is decentralized (you trust the DID if you trust the controller). But maybe communities will have verified creators lists, etc. Our platform could incorporate that (like a checkmark if the creator DID is verified by some authority or by our internal verification of identity).
  * We might also eventually integrate with Decentralized Identity profiles like ENS or others, where an artist can have a profile DID that links to social accounts. That can help prove that the DID corresponds to, say, a known Twitter artist. This is beyond pure tech – it’s community trust building.

* **Alternate Inscription Protocols or Upgrades:** If the ordinals or Bitcoin core protocol evolves (e.g., hypothetically an OP\_RETURN increase or a new way to store NFT metadata more natively), we’d adapt. There is talk in the community of how to handle JSON metadata (some proposals). We will stay involved and ready to support such enhancements natively rather than our own encoding if one emerges.

In summary, Phase 2 lays the foundation with DIDs and VCs. Future phases will refine these features, add more functionality (revocation, multi-chain identity), and push for adoption across the Bitcoin ecosystem. The vision is a robust framework where Bitcoin inscriptions are not just arbitrary files, but carry a rich, verifiable context that elevates them to true digital assets with provenance and identity – and we plan to evolve our platform to fully realize that vision.

## Development Timeline & Estimates

Below is an estimated timeline and effort breakdown for implementing Phase 2, considering the use of AI-assisted development to accelerate coding. We assume a small team (2-3 developers) working in parallel on different components. The timeline is in weeks, and tasks may overlap where possible:

* **Week 1: Specification Deep Dive & Design Finalization**
  *Activities:* Team studies the Ordinals Plus specs in detail, finalizes approach for embedding metadata (single vs dual inscription), and designs data models and API contracts. Set up project skeleton.
  *AI Assist:* Use GPT-4 to generate skeleton code for data models (DID Document class, VC class structures), saving time.
  *Est. Time:* 1 week (with AI, documentation reading still takes time but code scaffolding quicker).

* **Week 2: DID Method Implementation (Basic)**
  *Activities:* Implement DID creation in the inscription process:

  * Modify inscription transaction builder to include CBOR metadata (DID Document).
  * Build a DID resolution function that can read inscriptions from the indexer and decode CBOR to JSON.
    *AI Assist:* Generate code for CBOR encoding/decoding, parsing ord output. Possibly using AI to wrap ord command line for listing inscriptions on a sat.
    *Est. Time:* 1 week (AI helps with encoding logic, but testing on Bitcoin regtest might be needed to ensure correctness).

* **Week 3: VC Issuance Integration (Aces)**
  *Activities:* Develop the integration with Aces:

  * Implement the VCService that constructs credential JSON from inputs.
  * Connect to Aces API (possibly writing a swagger client if available, or manually crafting HTTP calls).
  * Handle responses and embed credential in the data flow.
    *AI Assist:* Quickly generate the HTTP client code and model classes for the Aces API request/response, using any documentation or standard OpenAPI if provided.
    *Est. Time:* 1 week (AI can reduce boilerplate significantly; main time is testing the end-to-end issuance with Aces test keys).

* **Week 4: Frontend UI for Metadata & DID**
  *Activities:* Create the user interface elements:

  * Update inscription form to include metadata fields and perhaps DID options.
  * Add a UI section for viewing verification status on inscription pages.
  * If applicable, pages for DID management and collection creation.
    *AI Assist:* Use AI to generate form component code or validation logic. Possibly use it to create a dynamic form from a schema (though careful with trust).
    *Est. Time:* 1 week (with AI helping on form generation, otherwise might be 1.5 weeks; also styling time needed).

* **Week 5: Curated Collection Feature**
  *Activities:* Implement the creation of Curated Collection credentials:

  * Backend: allow selecting multiple items and issuing a collection VC.
  * Inscribe the collection VC.
  * UI: form for collection creation, and display on collection page.
    *AI Assist:* Code generation for listing items and multi-select UI, and for assembling the collection VC JSON (which is similar to collectible with an array).
    *Est. Time:* 1 week (maybe less if parts reused from individual VC logic).

* **Week 6: DID Linked Resources Support (Basic)**
  *Activities:* Implement adding a resource to a DID:

  * Backend: function to inscribe additional content on a sat (ensuring sat ownership).
  * UI: interface to upload and label a resource.
  * Resolution: ensure `/info` and `/meta` endpoints work for resources.
    *AI Assist:* Could help generate the code for the resolution endpoints (like the snippet to parse DID URL and fetch from indexer).
    *Est. Time:* 1 week (some complexity in ensuring sat ownership and updating state, but AI speeds up writing the resource resolver code).

* **Week 7: Testing & Refinement**
  *Activities:* Comprehensive testing:

  * Unit tests for DID resolution (simulate inscriptions).
  * Integration test on Bitcoin testnet or regtest: create a real inscription with metadata and attempt resolution and verification.
  * UI testing for forms and verification display.
  * Fix any issues (e.g., if ordinals indexer not reading metadata properly, adjust approach).
    *AI Assist:* Generate unit test templates and even some mock data (AI can produce example CBOR bytes for test, etc.).
    *Est. Time:* 1 week (with AI generating many tests quickly, we focus on key scenarios and edge cases).

* **Week 8: Security Audit & Optimization**
  *Activities:* Review security aspects:

  * Penetration test the new endpoints (ensure no injection or auth bypass).
  * Optimize any slow parts (profile DID resolution loop, cache where needed).
  * Finalize documentation for these features (for internal use and possibly public docs for verification).
    *AI Assist:* Use AI to analyze code for potential vulnerabilities or suggest optimizations in algorithms.
    *Est. Time:* 1 week (some tasks in parallel with week 7 possibly).

* **Buffer:** It’s likely some tasks will overrun or bugs found requiring extra time. We include a **2-week buffer** for unplanned adjustments, spec changes, or additional polish (like improving UI or adding more tests).

**Total Estimated Time:** \~8 weeks of focused development + 2 weeks buffer = \~10 weeks (\~2.5 months). With AI assistance, we estimate we saved roughly 3-4 weeks compared to purely manual coding (which might have been 12-14 weeks otherwise for this scope). The AI mainly accelerates coding and testing, but integration and debugging still require human effort.

This timeline assumes no major changes in spec mid-way. If spec v0.3.0 comes out during development with changes, we might allocate part of buffer to adjust for that.

**Resource Allocation:**

* Dev 1: Focus on backend (inscription, DID, VC logic)
* Dev 2: Focus on frontend (forms, display)
* Dev 3: Support backend integration (Aces client, testing, maybe also assist on backend heavy parts)
* Plus involvement from a QA engineer especially in week 7-8 for dedicated testing.
* A UX designer may be involved early (week 1-2) to design the new form UI and badge visuals.

**Milestones:**

* End of Week 3: Have a demonstrable inscription with DID and dummy VC working on regtest (without UI).
* End of Week 5: Full flow working via API, UI partially done (maybe via an API test harness).
* End of Week 8: Feature complete, all tests passing, ready for staging deployment and further testing.

By following this plan, leveraging AI tools for routine coding and focusing human effort on complex integration and user experience, we aim to deliver a robust Phase 2 on schedule, providing the Ordinals community with a pioneering solution for verifiable, authentic Bitcoin inscriptions.
