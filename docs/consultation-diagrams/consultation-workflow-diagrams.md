# VetCare Consultation Module Diagrams

This document contains all the functional workflow diagrams for the VetCare platform's consultation module.

## 1. Pet Owner Consultation Booking and Management Workflow

```mermaid
flowchart TD
    A[Pet Owner/Farmer] --> B{Select Consultation Type}
    B --> C[Video Call]
    B --> D[Phone Call]
    B --> E[In-Person]
    B --> F[Chat Only]

    C --> G[Find Available Doctor]
    D --> G
    E --> G
    F --> G

    G --> H[Select Date & Time Slot]
    H --> I[Provide Consultation Details]
    I --> J[Animal Information]
    I --> K[Symptoms Description]
    I --> L[Priority Level]

    J --> M[Submit Booking Request]
    K --> M
    L --> M

    M --> N{Doctor Role}
    N --> O[Veterinarian Receives Notification]
    N --> P[Admin Receives Notification]

    O --> Q{Doctor Action}
    P --> Q

    Q --> R[Confirm Booking]
    Q --> S[Reschedule Request]
    Q --> T[Cancel Booking]

    R --> U[Booking Confirmed - Status: confirmed]
    S --> V[Pet Owner Selects New Slot]
    T --> W[Booking Cancelled - Status: cancelled]

    V --> X{Doctor Approves?}
    X --> Y[New Booking Confirmed]
    X --> Z[Reschedule Rejected]

    U --> AA[Consultation Day Approaches]
    Y --> AA

    AA --> BB{15 min before scheduled time}
    BB --> CC[Join Button Available]
    BB --> DD[Not Yet Available]

    CC --> EE[Start Consultation]
    EE --> FF[Video Session Created]
    FF --> GG[WebRTC Connection Established]
    GG --> HH[Real-time Video/Audio Chat]
    HH --> II[Doctor Takes Notes]
    HH --> JJ[Doctor Makes Diagnosis]
    HH --> KK[Doctor Creates Prescription]

    II --> LL[Consultation Completed]
    JJ --> LL
    KK --> LL

    LL --> MM[Session Ended]
    MM --> NN[Consultation Status: completed]
    NN --> OO[Pet Owner Can Write Review]
    NN --> PP[Medical Records Updated]
```

## 2. Veterinarian Consultation Management Workflow

```mermaid
flowchart TD
    A[Veterinarian] --> B[Login to Dashboard]
    B --> C[View Consultation Queue]
    C --> D{Booking Status}

    D --> E[Pending Bookings]
    D --> F[Confirmed Bookings]
    D --> G[Rescheduled Bookings]
    D --> H[Missed Bookings]

    E --> I{Action Required}
    I --> J[Confirm Booking]
    I --> K[Reschedule Request]
    I --> L[Cancel Booking]

    J --> M[Booking Status: confirmed]
    K --> N[Pet Owner Selects New Time]
    L --> O[Booking Status: cancelled]

    N --> P{Approve Reschedule?}
    P --> Q[New Booking Confirmed]
    P --> R[Reschedule Rejected]

    F --> S[Consultation Day]
    G --> S
    Q --> S

    S --> T{15 min before appointment}
    T --> U[Join Button Available]
    T --> V[Waiting for Patient]

    U --> W[Start Consultation]
    W --> X[Create Video Session]
    X --> Y[WebRTC Host Setup]
    Y --> Z[Wait for Patient Connection]

    Z --> AA[Patient Joins]
    AA --> BB[Real-time Consultation]
    BB --> CC[Video/Audio Communication]
    BB --> DD[Text Chat]
    BB --> EE[Screen Sharing]
    BB --> FF[Session Recording]

    CC --> GG[Medical Assessment]
    DD --> GG
    EE --> GG
    FF --> GG

    GG --> HH[Review Medical History]
    GG --> II[Examine Symptoms]
    GG --> JJ[Ask Questions]

    HH --> KK[Take Notes]
    II --> KK
    JJ --> KK

    KK --> LL[Make Diagnosis]
    LL --> MM[Create Prescription]
    MM --> NN[Update Medical Records]

    NN --> OO[End Consultation]
    OO --> PP[Mark as Completed]
    PP --> QQ[Generate Session Summary]
    QQ --> RR[Send to Pet Owner]

    H --> SS[Handle Missed Appointments]
    SS --> TT[Contact Pet Owner]
    TT --> UU[Reschedule if Needed]

    M --> VV[Send Confirmation Email]
    O --> WW[Send Cancellation Notice]
    Q --> VV
    R --> XX[Notify Rejection Reason]
```

## 3. Video Consultation Session Technical Flow

```mermaid
flowchart TD
    A[Consultation Started] --> B[Doctor Initiates Video Session]
    B --> C[Create Video Session Record in DB]
    C --> D[Doctor: WebRTC Host Mode]
    D --> E[Doctor: Request Camera/Microphone Access]

    E --> F{Device Access Granted?}
    F --> G[Video + Audio Stream]
    F --> H[Audio Only Stream]
    F --> I[No Media Stream]

    G --> J[Doctor: Create WebRTC Peer Connection]
    H --> J
    I --> J

    J --> K[Doctor: Create Offer (SDP)]
    K --> L[Send Offer to Signaling Server]
    L --> M[Patient Receives Notification]

    M --> N[Patient: Join Consultation Room]
    N --> O[Patient: WebRTC Guest Mode]
    O --> P[Patient: Request Camera/Microphone Access]

    P --> Q{Device Access Granted?}
    Q --> R[Video + Audio Stream]
    Q --> S[Audio Only Stream]
    Q --> T[No Media Stream]

    R --> U[Patient: Create WebRTC Peer Connection]
    S --> U
    T --> U

    U --> V[Patient: Send Answer to Signaling Server]
    V --> W[WebRTC Connection Established]

    W --> X[ICE Candidate Exchange]
    X --> Y[STUN/TURN Server Coordination]
    Y --> Z[Peer-to-Peer Connection]

    Z --> AA[Real-time Media Streaming]
    AA --> BB[Video Frames]
    AA --> CC[Audio Stream]
    AA --> DD[Data Channel for Chat]

    BB --> EE[Doctor Video Element]
    CC --> FF[Audio Playback]
    DD --> GG[Text Messages]

    EE --> HH[Consultation Active]
    FF --> HH
    GG --> HH

    HH --> II{Consultation Actions}
    II --> JJ[Doctor: Take Notes]
    II --> KK[Doctor: Make Diagnosis]
    II --> LL[Doctor: Create Prescription]
    II --> MM[Screen Sharing]
    II --> NN[Session Recording]
    II --> OO[End Consultation]

    JJ --> PP[Save to Consultation Record]
    KK --> PP
    LL --> PP
    MM --> QQ[Share Screen Stream]
    NN --> RR[Record Media Stream]

    OO --> SS[Close WebRTC Connection]
    SS --> TT[Update Session Status: ended]
    TT --> UU[Update Consultation Status: completed]
    UU --> VV[Generate Session Summary]
    VV --> WW[Send to Pet Owner]
```

## 4. Consultation Status State Transitions

```mermaid
stateDiagram-v2
    [*] --> scheduled: Consultation Created

    scheduled --> in_progress: Start Consultation
    scheduled --> cancelled: Cancel Booking
    scheduled --> missed: No Show (auto-marked by scheduler)

    in_progress --> completed: End Consultation
    in_progress --> cancelled: Cancel During Session

    completed --> [*]: Consultation Finished
    cancelled --> [*]: Consultation Cancelled
    missed --> [*]: Consultation Missed

    scheduled --> rescheduled: Reschedule Request
    rescheduled --> scheduled: New Time Confirmed
    rescheduled --> cancelled: Reschedule Rejected

    missed --> scheduled: Reschedule After Miss
    cancelled --> scheduled: Rebook After Cancel

    note right of missed
      missed_by is set automatically:
      - doctor: No video session created
        (doctor never opened room)
      - patient: Video session in 'waiting'
        (doctor showed, patient absent)
    end note
```

## 5. Farmer Enterprise Consultation Workflow

```mermaid
flowchart TD
    A[Farmer] --> B[Login to VetCare Platform]
    B --> C[Access Enterprise Dashboard]
    C --> D{Consultation Context}

    D --> E[Individual Animal Consultation]
    D --> F[Herd/Enterprise Consultation]
    D --> G[Animal Group Consultation]

    E --> H[Select Specific Animal]
    F --> I[Select Enterprise/Farm]
    G --> J[Select Animal Group]

    H --> K[Choose Consultation Type]
    I --> K
    J --> K

    K --> L[Video Call]
    K --> M[Phone Call]
    K --> N[In-Person Visit]
    K --> O[Chat Consultation]

    L --> P[Find Available Veterinarian]
    M --> P
    N --> P
    O --> P

    P --> Q[Select Date & Time Slot]
    Q --> R[Provide Consultation Details]

    R --> S[Animal Information]
    R --> T[Symptoms Description]
    R --> U[Priority Level]
    R --> V[Enterprise Context]
    R --> W[Group Information]

    S --> X[Submit Booking Request]
    T --> X
    U --> X
    V --> X
    W --> X

    X --> Y[Veterinarian Receives Notification]
    Y --> Z{Doctor Review}

    Z --> AA[Confirm Booking]
    Z --> BB[Request Reschedule]
    Z --> CC[Cancel Booking]

    AA --> DD[Booking Status: confirmed]
    BB --> EE[Farmer Selects New Time]
    CC --> FF[Booking Status: cancelled]

    EE --> GG{Doctor Approves?}
    GG --> HH[New Booking Confirmed]
    GG --> II[Reschedule Rejected]

    DD --> JJ[Consultation Day]
    HH --> JJ

    JJ --> KK{15 min before appointment}
    KK --> LL[Join Consultation]
    KK --> MM[Wait for Join Window]

    LL --> NN[Start Video Consultation]
    NN --> OO[WebRTC Connection]
    OO --> PP[Real-time Communication]

    PP --> QQ[Doctor Reviews Farm Context]
    PP --> RR[Doctor Examines Animals]
    PP --> SS[Doctor Assesses Herd Health]

    QQ --> TT[Take Medical Notes]
    RR --> TT
    SS --> TT

    TT --> UU[Make Diagnosis]
    UU --> VV[Create Prescriptions]
    VV --> WW[Update Medical Records]

    WW --> XX[End Consultation]
    XX --> YY[Mark as Completed]
    YY --> ZZ[Generate Farm Report]
    ZZ --> AAA[Update Enterprise Records]

    FF --> BBB[Handle Cancellation]
    II --> CCC[Handle Rejection]

    BBB --> DDD[Rebook if Needed]
    CCC --> DDD

    DDD --> EEE[Select New Doctor/Time]
    EEE --> X
```

## 6. Admin Consultation Oversight Workflow

```mermaid
flowchart TD
    A[Admin] --> B[Login to Admin Dashboard]
    B --> C[Access Consultation Management]
    C --> D{Admin Actions}

    D --> E[View All Consultations]
    D --> F[Monitor System Health]
    D --> G[Handle Escalations]
    D --> H[Override Permissions]

    E --> I{Consultation Status}
    I --> J[Pending Bookings]
    I --> K[Active Consultations]
    I --> L[Completed Consultations]
    I --> M[Problematic Cases]

    J --> N{Action Needed?}
    N --> O[Confirm Urgent Bookings]
    N --> P[Reassign to Different Doctor]
    N --> Q[Cancel Invalid Bookings]

    O --> R[Send Confirmation]
    P --> S[Update Assignment]
    Q --> T[Notify Parties]

    K --> U[Monitor Active Sessions]
    U --> V[View Real-time Status]
    U --> W[Access Session Recordings]
    U --> X[Intervene if Needed]

    L --> Y[Review Completed Cases]
    Y --> Z[Check Quality Metrics]
    Y --> AA[Audit Documentation]
    Y --> BB[Generate Reports]

    M --> CC{Problem Type}
    CC --> DD[Missed Appointments]
    CC --> EE[Technical Issues]
    CC --> FF[User Complaints]
    CC --> GG[Payment Disputes]

    DD --> HH[Contact Parties]
    EE --> II[Troubleshoot Issues]
    FF --> JJ[Mediate Disputes]
    GG --> KK[Resolve Payments]

    F --> LL[System Monitoring]
    LL --> MM[Check Server Health]
    LL --> NN[Monitor WebRTC Connections]
    LL --> OO[Review Error Logs]
    LL --> PP[Performance Analytics]

    G --> QQ[Handle Escalations]
    QQ --> RR[Priority Reassignments]
    QQ --> SS[Emergency Interventions]
    QQ --> TT[Policy Enforcement]

    H --> UU[Override Actions]
    UU --> VV[Bypass Doctor Confirmation]
    UU --> WW[Force Status Changes]
    UU --> XX[Access Restricted Data]

    R --> YY[Update Records]
    S --> YY
    T --> YY
    V --> ZZ[Log Activities]
    W --> ZZ
    X --> ZZ
    Z --> AA
    AA --> AA
    BB --> AA
    HH --> YY
    II --> YY
    JJ --> YY
    KK --> YY
    MM --> ZZ
    NN --> ZZ
    OO --> ZZ
    PP --> ZZ
    RR --> YY
    SS --> YY
    TT --> YY
    VV --> YY
    WW --> YY
    XX --> ZZ
```

## 7. Booking Creation and Deduplication Workflow

```mermaid
flowchart TD
    A[User Initiates Booking] --> B[Select Doctor, Date, Time, Animal]
    B --> C[Submit Booking Request]
    C --> D[Validate Input Data]

    D --> E{Validation Passed?}
    E --> F[Create Booking Record]
    E --> G[Return Validation Error]

    F --> H[Booking Status: pending]
    H --> I[Send Notification to Doctor]
    I --> J[Send Confirmation to User]

    J --> K{Doctor Action}
    K --> L[Confirm Booking]
    K --> M[Request Reschedule]
    K --> N[Cancel Booking]

    L --> O[Booking Status: confirmed]
    M --> P[User Selects New Time]
    N --> Q[Booking Status: cancelled]

    P --> R{Doctor Approves?}
    R --> S[New Booking: confirmed]
    R --> T[Reschedule Rejected]

    O --> U[Consultation Day]
    S --> U

    U --> V{15 min before time}
    V --> W[Join Button Available]
    V --> X[Wait for Window]

    W --> Y[User Clicks Start Consultation]
    Y --> Z[Check for Existing Consultation]

    Z --> AA{Consultation Exists?}
    AA --> BB[Navigate to Existing Consultation]
    AA --> CC[Create New Consultation]

    CC --> DD[Link Booking to Consultation]
    DD --> EE[Start Video Session]
    EE --> FF[WebRTC Connection]

    BB --> FF
    FF --> GG[Consultation Active]

    G --> HH[End Process]
    T --> HH
    Q --> HH
```

## 8. Consultation Module Architecture and Data Flow

```mermaid
flowchart TD
    A[Frontend Components] --> B[Consultations.tsx]
    A --> C[BookConsultation.tsx]
    A --> D[VideoConsultation.tsx]
    A --> E[doctor/ConsultationRoom.tsx]

    B --> F[API Service Calls]
    C --> F
    D --> F
    E --> F

    F --> G[Backend API Routes]
    G --> H[/api/v1/consultations]
    G --> I[/api/v1/bookings]
    G --> J[/api/v1/video-sessions]

    H --> K[ConsultationController]
    I --> L[BookingController]
    J --> M[VideoSessionController]

    K --> N[ConsultationService]
    L --> O[BookingService]
    M --> P[VideoSessionService]

    N --> Q[Database Layer]
    O --> Q
    P --> Q

    Q --> R[(PostgreSQL)]
    R --> S[consultations table]
    R --> T[bookings table]
    R --> U[video_sessions table]
    R --> V[users table]
    R --> W[animals table]

    N --> X[WebRTC Integration]
    P --> X

    X --> Y[Signaling Server]
    X --> Z[STUN/TURN Servers]

    E --> AA[useWebRTC Hook]
    D --> AA

    AA --> BB[Peer Connection]
    AA --> CC[Media Streams]
    AA --> DD[Data Channels]

    K --> EE[Notification System]
    L --> EE
    M --> EE

    EE --> FF[Email Service]
    EE --> GG[In-App Notifications]

    N --> HH[Medical Records Integration]
    HH --> II[PrescriptionService]
    HH --> JJ[MedicalRecordService]

    O --> KK[ScheduleService]
    KK --> LL[Vet Availability]
    KK --> MM[Time Slots]

    B --> NN[PermissionContext]
    C --> NN
    D --> NN
    E --> NN

    NN --> OO[Role-based Access]
    OO --> PP[pet_owner permissions]
    OO --> QQ[veterinarian permissions]
    OO --> RR[farmer permissions]
    OO --> SS[admin permissions]
```

## 9. Consultation Session Sequence Diagram

```mermaid
sequenceDiagram
    participant PO as Pet Owner
    participant FE as Frontend
    participant BE as Backend API
    participant DB as Database
    participant VET as Veterinarian
    participant WS as WebSocket/Signaling

    PO->>FE: Click "Book Consultation"
    FE->>BE: GET /api/v1/vets (list available doctors)
    BE->>DB: Query veterinarians
    DB-->>BE: Return vet list
    BE-->>FE: Return vets data

    PO->>FE: Select vet, date, time, animal
    FE->>BE: POST /api/v1/bookings (create booking)
    BE->>DB: Insert booking record
    DB-->>BE: Booking created
    BE-->>FE: Booking response
    FE-->>PO: Show booking confirmation

    BE->>VET: Send booking notification
    VET->>FE: Login to dashboard
    FE->>BE: GET /api/v1/bookings (list bookings)
    BE->>DB: Query bookings
    DB-->>BE: Return bookings
    BE-->>FE: Return bookings data
    FE-->>VET: Display pending booking

    VET->>FE: Click "Confirm Booking"
    FE->>BE: PUT /api/v1/bookings/:id/confirm
    BE->>DB: Update booking status to confirmed
    DB-->>BE: Status updated
    BE-->>FE: Confirmation response
    FE-->>VET: Show confirmation
    BE-->>PO: Send confirmation notification

    Note over PO,VET: Consultation Day

    PO->>FE: Click "Join Consultation" (15min before)
    FE->>BE: POST /api/v1/consultations (create consultation)
    BE->>DB: Check for existing consultation
    DB-->>BE: No existing found
    BE->>DB: Insert consultation record
    DB-->>BE: Consultation created
    BE->>DB: Link booking to consultation
    DB-->>BE: Link updated
    BE-->>FE: Consultation response
    FE-->>PO: Navigate to video room

    PO->>FE: Join video consultation room
    FE->>BE: GET /api/v1/video-sessions?consultationId=...
    BE->>DB: Check existing video session
    DB-->>BE: No session found
    BE->>DB: Create video session record
    DB-->>BE: Session created
    BE-->>FE: Return session data
    FE-->>WS: Connect to signaling server
    WS-->>FE: Connection established

    VET->>FE: Enter consultation room
    FE->>BE: GET /api/v1/video-sessions?consultationId=...
    BE->>DB: Return existing session
    DB-->>BE: Session data
    BE-->>FE: Return session data
    FE-->>WS: Connect to signaling server

    FE->>FE: WebRTC: Doctor creates offer
    FE->>WS: Send WebRTC offer
    WS->>FE: Forward offer to patient
    FE->>FE: WebRTC: Patient creates answer
    FE->>WS: Send WebRTC answer
    WS->>FE: Forward answer to doctor

    FE->>FE: ICE candidate exchange
    FE->>FE: Peer-to-peer connection established

    PO->>FE: Send chat message
    FE->>BE: POST /api/v1/video-sessions/:id/messages
    BE->>DB: Insert message
    DB-->>BE: Message saved
    BE-->>WS: Broadcast message
    WS-->>FE: Deliver to doctor
    FE-->>VET: Display message

    VET->>FE: Take notes, make diagnosis
    FE->>BE: PUT /api/v1/consultations/:id
    BE->>DB: Update consultation record
    DB-->>BE: Record updated
    BE-->>FE: Update response

    VET->>FE: Create prescription
    FE->>BE: POST /api/v1/prescriptions
    BE->>DB: Insert prescription
    DB-->>BE: Prescription created
    BE-->>FE: Prescription response

    VET->>FE: End consultation
    FE->>BE: PUT /api/v1/consultations/:id (status: completed)
    BE->>DB: Update consultation status
    DB-->>BE: Status updated
    BE->>BE: Update booking status
    DB-->>BE: Booking updated
    BE-->>FE: Completion response
    FE-->>VET: Show completion
    BE-->>PO: Send completion notification
```

---

**Created:** March 10, 2026
**Updated:** May 2026 — Added missed_by tracking and no-show reschedule diagrams
**VetCare Platform Version:** v1.0
**Analysis:** Deep consultation module workflow analysis

## 10. No-Show Detection and Reschedule Rules Workflow

This diagram shows how the system detects WHO missed an appointment and applies the appropriate reschedule rules.

```mermaid
flowchart TD
    A[Scheduler: every 15 minutes] --> B{Confirmed bookings\npast their window?}
    B -- No --> A
    B -- Yes --> C[Evaluate who missed]

    C --> D{Video session exists\nfor this booking's\nconsultation?}

    D -- No consultation at all\nconsultation_id IS NULL --> E[missed_by = 'doctor']
    D -- Consultation exists,\nno video session --> F[missed_by = 'doctor']
    D -- Video session exists\nstatus = 'waiting' --> G[missed_by = 'patient']
    D -- Consultation completed\nor in_progress --> H[Skip — do not mark missed]

    E --> I[UPDATE bookings SET\nstatus = 'missed',\nmissed_by = 'doctor']
    F --> I
    G --> J[UPDATE bookings SET\nstatus = 'missed',\nmissed_by = 'patient']

    I --> K{Who sees the booking?}
    J --> K

    K --> L[Pet Owner / Farmer Dashboard]
    K --> M[Veterinarian Dashboard]
    K --> N[Admin Dashboard]

    L --> O{missedBy value?}
    O -- doctor --> P[🩺 Doctor No-Show badge\nUnlimited reschedules allowed]
    O -- patient --> Q[🙋 Patient No-Show badge\nPatientNoShowLimit applies]
    O -- both --> R[❌ Both No-Show badge\nPatientNoShowLimit applies]

    P --> S[Show Reschedule button\nwith any doctor option]
    Q --> T{rescheduleCount < limit?}
    R --> T
    T -- Yes --> U[Show Reschedule button\nwith reschedule count shown]
    T -- No --> V[Reschedule blocked\nContact support message]

    M --> W[Show missed_by badge\nfor context only]
    N --> X[Admin can adjust\npatientNoShowLimit\nin System Settings]
```

## 11. Admin No-Show Reschedule Limit Configuration

This diagram shows how admins configure the patient no-show reschedule policy.

```mermaid
flowchart TD
    A[Admin] --> B[System Settings Page]
    B --> C[Booking — No-Show Reschedule Rules]

    C --> D[Doctor No-Show Section]
    D --> E[Always Unlimited — fixed]
    E --> F[Patients get unlimited\nreschedule opportunities\nwhen doctor is at fault]

    C --> G[Patient No-Show Limit Section]
    G --> H{Select limit}
    H --> I[0 = Unlimited]
    H --> J[1 = Once only]
    H --> K[2 = Twice]
    H --> L[Custom number]

    I --> M[Save to system_settings:\nbooking.patientNoShowRescheduleLimit = 0]
    J --> N[Save to system_settings:\nbooking.patientNoShowRescheduleLimit = 1]
    K --> O[Save to system_settings:\nbooking.patientNoShowRescheduleLimit = 2]
    L --> P[Save custom value]

    M --> Q[SettingsContext reloads]
    N --> Q
    O --> Q
    P --> Q

    Q --> R[All frontend components\nget new limit in real-time]
    R --> S[Consultations.tsx:\ncanReschedule() uses new limit]
    R --> T[Reschedule modal:\nshows updated count info]
    R --> U[BookingService.ts:\nrescheduleBooking() enforces limit]
```