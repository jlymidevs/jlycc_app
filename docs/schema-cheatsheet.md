# JLY Church Database - Schema Cheat Sheet

> **PostgreSQL 16** | **9 schemas** | **55+ tables** | **V063** | **250+ pgTAP tests**

---

## Schema Dependency Map

```
                    +------------------+
                    |      core        |  Foundation: person, branch,
                    |  9 tables        |  region, household, address
                    +--------+---------+
                             |
                    +--------+---------+
                    |   membership     |  Member lifecycle, roles,
                    |   8 tables       |  pastoral care, applications
                    +--------+---------+
                             |
          +------------------+------------------+
          |                  |                  |
  +-------+------+  +-------+------+  +--------+-----+
  |  ministries  |  |    events    |  |  attendance   |
  |  4 tables    |  |   6 tables   |  |  3 tables     |
  |  Network →   |  |  Types →     |  |  Partitioned  |
  |  Ministry →  |  |  Series →    |  |  check_in +   |
  |  Chapter     |  |  Event       |  |  FTV + child  |
  +--------------+  +--------------+  +--------------+
          |
  +-------+------+  +--------------+  +--------------+
  |   programs   |  |   missions   |  |  education   |
  |  4 tables    |  |   6 tables   |  |  15 tables   |
  |  Heartlink   |  |  Scholars +  |  |  BC (9) +    |
  |  cohorts     |  |  BAC outreach|  |  ISU (5) +   |
  +--------------+  +--------------+  |  school (1)  |
                                      +--------------+

  +--------------+
  |   staging    |  Migration ETL pipeline
  |   5 tables   |  Load → Cleanse → Validate → Promote
  +--------------+
```

---

## Tables by Schema

### core (9 tables, 3 views)
| Table | PK | Key FKs | Purpose |
|---|---|---|---|
| `region` | region_id | self-ref parent | Geographic clusters |
| `branch` | branch_id | region | Church sites |
| `address` | address_id | - | Reusable addresses |
| `person` | person_id | - | Every individual (soft-delete) |
| `contact_info` | contact_id | person | Phone, email, etc. |
| `person_address` | composite | person, address | Address history |
| `household` | household_id | branch, address, person | Family units |
| `household_member` | composite | household, person | Family roles |
| `kinship` | kinship_id | person x2 | Family relationships |

### membership (8 tables)
| Table | PK | Key FKs | Purpose |
|---|---|---|---|
| `lifecycle_stage` | stage_code | - | FTV/OGV/RA/REGULAR_MEMBER/DFL |
| `role` | role_id | - | PASTOR, ADMIN_STAFF, PCM, etc. |
| `member` | member_id | person, branch, stage | Church member record |
| `member_role` | member_role_id | member, role | Stackable role assignments |
| `lifecycle_stage_history` | history_id | member | Auto-tracked transitions |
| `branch_membership_history` | history_id | member | Auto-tracked transfers |
| `regular_member_application` | application_id | member | Membership applications |
| `pastoral_care_assignment` | assignment_id | member x2 | PCM carer assignments |

### ministries (4 tables)
| Table | PK | Key FKs | Purpose |
|---|---|---|---|
| `network` | network_id | - | Top level (MEN, WOMEN, KIDS) |
| `ministry` | ministry_id | network | Ministry definition |
| `ministry_chapter` | chapter_id | ministry, branch | Per-branch instance |
| `ministry_membership` | membership_id | chapter, member | Member in ministry |

### events (6 tables)
| Table | PK | Key FKs | Purpose |
|---|---|---|---|
| `event_category` | category_code | - | REGULAR, SPECIAL, CAMP |
| `event_type` | event_type_id | category | SUNDAY_SERVICE, CAMP_MEETING |
| `event_series` | series_id | event_type | Recurring pattern |
| `event` | event_id | event_type, series, branch | Single occurrence |
| `event_organizer` | composite | event, member | Event organizers |
| `event_registration` | registration_id | event, person | RSVP / registration |

### attendance (3 tables, 1 view)
| Table | PK | Key FKs | Purpose |
|---|---|---|---|
| `check_in` | composite | event, person, branch | **Partitioned by month** |
| `visitor_capture` | ftv_capture_id | person, event, branch | FTV intake form |
| `child_check_in` | composite | check_in | Pickup code + allergies |
| `attendance_summary` | - | - | **VIEW**: aggregates by event |

### programs (4 tables)
| Table | PK | Key FKs | Purpose |
|---|---|---|---|
| `heartlink_cohort` | cohort_id | branch, member | Discipleship cohort |
| `heartlink_enrollment` | enrollment_id | cohort, person | Participant enrollment |
| `heartlink_session` | session_id | cohort | Session within cohort |
| `heartlink_session_attendance` | attendance_id | session, enrollment | Per-session attendance |

### missions (6 tables)
| Table | PK | Key FKs | Purpose |
|---|---|---|---|
| `scholar_program` | program_id | - | Scholarship program |
| `scholarship_award` | award_id | program, member | Award to a member |
| `bac_initiative` | initiative_id | branch, member | BAC outreach campaign |
| `bac_session` | session_id | initiative | Session in campaign |
| `bac_participant` | participant_id | initiative, person | Campaign participant |
| `bac_session_attendance` | attendance_id | session, person | Per-session (walk-ins OK) |

### education (15 tables)
| Table | PK | Key FKs | Purpose |
|---|---|---|---|
| `school` | school_id | - | Lookup: BIBLE_COLLEGE, ISU |
| `bc_program` | program_id | - | Academic program |
| `bc_cohort` | cohort_id | program | Student cohort |
| `bc_semester` | semester_id | - | Academic term |
| `bc_course` | course_id | - | Course catalog |
| `bc_course_offering` | offering_id | course, semester | Course in a semester |
| `bc_student` | student_id | person, cohort | Student record |
| `bc_enrollment` | enrollment_id | student, offering | Course enrollment |
| `bc_completion` | enrollment_id | enrollment (1:1) | Completion + attendance_rate |
| `bc_class_attendance` | attendance_id | offering, student | Per-class attendance |
| `isu_track` | track_id | - | Learning track |
| `isu_student` | student_id | person, track | ISU student |
| `isu_track_progression` | progression_id | student, track x2 | Track change history |
| `isu_session` | session_id | branch, track | Teaching session |
| `isu_session_attendance` | attendance_id | session, person | Per-session attendance |

### staging (5 tables)
| Table | PK | Key FKs | Purpose |
|---|---|---|---|
| `import_batch` | batch_id (UUID) | - | Batch tracker |
| `stg_person` | staging_id | batch | Raw person import (all TEXT) |
| `dedup_run` | run_id | batch | Dedup pass tracker |
| `person_candidate` | candidate_id | run, stg_person | Normalized candidates |
| `person_merge_review` | review_id | run, candidate x2 | Manual review queue |

---

## Key Design Decisions

| Decision | Rationale |
|---|---|
| `person` is the universal entity | FTVs, visitors, and non-members can participate in programs, events, and education without a member record |
| `branch_id` on every operational entity | Multi-branch from day one; all queries can filter by branch |
| Lifecycle stages are seeded lookup, not enum | Stages can be added/modified without schema migration |
| Roles are stackable (not exclusive) | A person can be PASTOR + ADMIN_STAFF simultaneously |
| `check_in` is partitioned by month | High-volume table; monthly partitions for query performance |
| No grades/GPA in education | Attendance-only tracking per church requirements |
| `staging` tables use all-TEXT columns | Source data arrives untyped from Google Sheets |
| History tables are trigger-driven | Lifecycle and branch changes auto-logged |
| Soft deletes on person/member/household | Preserve referential integrity; filter via `*_active` views |

---

*Generated from JLY Church Database V063 (Plan 4 complete)*
