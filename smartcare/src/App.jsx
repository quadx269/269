
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  HeartPulse,
  LayoutDashboard,
  ListOrdered,
  Menu,
  Monitor,
  Plus,
  Search,
  ShieldCheck,
  Stethoscope,
  UserPlus,
  Users,
  X,
} from "lucide-react";

import "./index.css";
import Login from "./Login.jsx";
import { supabase } from "./supabase";

const priorities = {
  Emergency: 0,
  Urgent: 1,
  Routine: 2,
};

const priorityDescriptions = {
  Emergency: "Immediate clinical attention",
  Urgent: "Prompt staff assessment",
  Routine: "Standard queue",
};

function fromDatabase(row) {
  return {
    id: row.token,
    name: row.name ?? "",
    age: row.age ?? "",
    phone: row.phone ?? "",
    symptoms: row.symptoms ?? "",
    duration: row.duration ?? "Today",
    department: row.department ?? "General Medicine",
    urgency: row.urgency ?? "Routine",
    notes: row.notes ?? "",
    status: row.status ?? "Waiting",
    createdAt: row.created_at
      ? new Date(row.created_at).getTime()
      : Date.now(),
  };
}

function makeInitialForm() {
  return {
    name: "",
    age: "",
    phone: "",
    symptoms: "",
    duration: "Today",
    department: "General Medicine",
    urgency: "Routine",
    notes: "",
  };
}

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function urgencyClass(urgency) {
  return urgency.toLowerCase();
}

function StatusBadge({ status }) {
  return (
    <span
      className={`status-badge status-${status
        .toLowerCase()
        .replaceAll(" ", "-")}`}
    >
      {status}
    </span>
  );
}

function PriorityBadge({ urgency }) {
  return (
    <span className={`priority-badge priority-${urgencyClass(urgency)}`}>
      <span className="priority-dot" />
      {urgency}
    </span>
  );
}

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [patients, setPatients] = useState([]);
  const [page, setPage] = useState("Dashboard");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [form, setForm] = useState(makeInitialForm);
  const [notice, setNotice] = useState("");
  const [mobileMenu, setMobileMenu] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadPatients() {
      const { data, error } = await supabase
        .from("patients")
        .select("*")
        .order("created_at", { ascending: true });

      if (!isMounted) return;

      if (error) {
        setNotice(`Database error: ${error.message}`);
        return;
      }

      setPatients((data ?? []).map(fromDatabase));
    }

    loadPatients();

    return () => {
      isMounted = false;
    };
  }, []);

  const sortedPatients = useMemo(() => {
    return [...patients].sort((a, b) => {
      if (a.status === "Completed" && b.status !== "Completed") return 1;
      if (b.status === "Completed" && a.status !== "Completed") return -1;

      const priorityDifference =
        (priorities[a.urgency] ?? 2) - (priorities[b.urgency] ?? 2);

      if (priorityDifference !== 0) return priorityDifference;

      return a.createdAt - b.createdAt;
    });
  }, [patients]);

  const waitingCount = patients.filter(
    (patient) => patient.status === "Waiting"
  ).length;

  const emergencyCount = patients.filter(
    (patient) =>
      patient.urgency === "Emergency" &&
      patient.status !== "Completed"
  ).length;

  const inConsultationCount = patients.filter(
    (patient) => patient.status === "In Consultation"
  ).length;

  const completedCount = patients.filter(
    (patient) => patient.status === "Completed"
  ).length;

  const filteredPatients = sortedPatients.filter((patient) => {
    const query = search.toLowerCase();

    const matchesSearch =
      patient.name.toLowerCase().includes(query) ||
      String(patient.id).toLowerCase().includes(query) ||
      patient.symptoms.toLowerCase().includes(query);

    const matchesFilter =
      filter === "All" ||
      patient.urgency === filter ||
      patient.status === filter;

    return matchesSearch && matchesFilter;
  });

  function showNotice(message) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3500);
  }

  function handleLogin() {
    setIsLoggedIn(true);
  }

  function handleLogout() {
    setIsLoggedIn(false);
    setMobileMenu(false);
    setPage("Dashboard");
    setSearch("");
    setFilter("All");
  }

  function updateField(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function registerPatient(event) {
    event.preventDefault();

    const token = `SC${Date.now().toString().slice(-7)}`;

    const { data, error } = await supabase
      .from("patients")
      .insert([
        {
          token,
          name: form.name.trim(),
          age: Number(form.age),
          phone: form.phone.trim() || null,
          symptoms: form.symptoms.trim(),
          duration: form.duration,
          department: form.department,
          urgency: form.urgency,
          notes: form.notes.trim() || null,
          status: "Waiting",
        },
      ])
      .select()
      .single();

    if (error) {
      showNotice(`Could not save patient: ${error.message}`);
      return;
    }

    setPatients((current) => [...current, fromDatabase(data)]);
    setForm(makeInitialForm());
    setPage("Patient Queue");
    setSearch("");
    setFilter("All");

    showNotice(`Patient saved successfully. Token: ${token}`);
  }

  async function updateStatus(id, status) {
    const { error } = await supabase
      .from("patients")
      .update({ status })
      .eq("token", id);

    if (error) {
      showNotice(`Could not update status: ${error.message}`);
      return;
    }

    setPatients((current) =>
      current.map((patient) =>
        patient.id === id ? { ...patient, status } : patient
      )
    );

    const messages = {
      Called: "Patient called successfully.",
      "In Consultation": "Consultation started.",
      Completed: "Consultation marked as completed.",
      Waiting: "Patient returned to the waiting queue.",
    };

    showNotice(messages[status] || "Patient status updated.");
  }

  function openPage(nextPage) {
    setPage(nextPage);
    setMobileMenu(false);
    setSearch("");
    setFilter("All");
  }

  function callNextPatient() {
    const next = sortedPatients.find(
      (patient) => patient.status === "Waiting"
    );

    if (!next) {
      showNotice("There are no waiting patients.");
      return;
    }

    updateStatus(next.id, "Called");
  }

  const navigation = [
    { name: "Dashboard", icon: LayoutDashboard },
    { name: "Register Patient", icon: UserPlus },
    { name: "Patient Queue", icon: ListOrdered },
    { name: "Staff Panel", icon: Monitor },
  ];

  // Show the separate login component before the dashboard.
  if (!isLoggedIn) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-icon">
            <HeartPulse size={27} />
          </div>

          <div>
            <h1>SmartCare</h1>
            <p>Patient Queue System</p>
          </div>

          <button
            className="icon-button close-menu"
            onClick={() => setMobileMenu(false)}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        <div className="hospital-label">HOSPITAL MANAGEMENT</div>

        <nav className="navigation">
          {navigation.map(({ name, icon: Icon }) => (
            <button
              key={name}
              className={`nav-link ${page === name ? "active" : ""}`}
              onClick={() => openPage(name)}
            >
              <Icon size={19} />
              <span>{name}</span>

              {name === "Patient Queue" && waitingCount > 0 && (
                <span className="nav-count">{waitingCount}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="secure-card">
            <ShieldCheck size={22} />
            <div>
              <strong>Staff workspace</strong>
              <p>Demo mode</p>
            </div>
          </div>

          <p className="sidebar-footer">SmartCare © 2026</p>
        </div>
      </aside>

      {mobileMenu && (
        <button
          className="mobile-overlay"
          aria-label="Close navigation"
          onClick={() => setMobileMenu(false)}
        />
      )}

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button menu-toggle"
              onClick={() => setMobileMenu(true)}
              aria-label="Open menu"
            >
              <Menu size={22} />
            </button>

            <div>
              <div className="breadcrumb">SmartCare / {page}</div>
              <h2>{page}</h2>
            </div>
          </div>

          <div className="staff-profile">
            <div className="staff-avatar">
              <Stethoscope size={19} />
            </div>

            <div className="staff-info">
              <strong>Hospital Staff</strong>
              <span>Demo workspace</span>
            </div>

            <button
              type="button"
              className="secondary-button"
              onClick={handleLogout}
              style={{ marginLeft: "12px" }}
            >
              Sign out
            </button>
          </div>
        </header>

        <div className="page-content">
          {notice && (
            <div className="toast" role="status">
              <CheckCircle2 size={20} />
              <span>{notice}</span>

              <button
                className="icon-button"
                onClick={() => setNotice("")}
                aria-label="Dismiss notification"
              >
                <X size={17} />
              </button>
            </div>
          )}

          {page === "Dashboard" && (
            <>
              <section className="welcome-row">
                <div>
                  <p className="eyebrow">HOSPITAL OVERVIEW</p>
                  <h3>Good care starts with a clear queue.</h3>
                  <p className="muted">
                    Monitor patients, review priorities and manage consultations.
                  </p>
                </div>

                <button
                  className="primary-button"
                  onClick={() => openPage("Register Patient")}
                >
                  <Plus size={19} /> Register Patient
                </button>
              </section>

              <section className="stats-grid">
                <StatCard
                  title="Total patients"
                  value={patients.length}
                  detail="All registered patients"
                  icon={Users}
                  color="blue"
                />

                <StatCard
                  title="Waiting"
                  value={waitingCount}
                  detail="Patients awaiting a call"
                  icon={Clock}
                  color="orange"
                />

                <StatCard
                  title="Emergency review"
                  value={emergencyCount}
                  detail="Requires immediate attention"
                  icon={AlertCircle}
                  color="red"
                />

                <StatCard
                  title="Completed"
                  value={completedCount}
                  detail="Consultations finished"
                  icon={CheckCircle2}
                  color="green"
                />
              </section>

              <section className="content-card">
                <div className="section-heading">
                  <div>
                    <h3>Current patient queue</h3>
                    <p>Higher urgency is shown first.</p>
                  </div>

                  <button
                    className="text-button"
                    onClick={() => openPage("Patient Queue")}
                  >
                    View all <ArrowRight size={17} />
                  </button>
                </div>

                <PatientTable
                  patients={sortedPatients
                    .filter((patient) => patient.status !== "Completed")
                    .slice(0, 5)}
                  onStatus={updateStatus}
                />

                {sortedPatients.filter(
                  (patient) => patient.status !== "Completed"
                ).length === 0 && (
                  <EmptyState text="No patients are currently waiting." />
                )}
              </section>

              <div className="bottom-grid">
                <section className="content-card">
                  <div className="section-heading">
                    <div>
                      <h3>Quick actions</h3>
                      <p>Common staff tasks</p>
                    </div>
                  </div>

                  <div className="quick-actions">
                    <button
                      className="quick-action"
                      onClick={() => openPage("Register Patient")}
                    >
                      <span className="quick-icon blue-bg">
                        <UserPlus />
                      </span>
                      <span>
                        <strong>New registration</strong>
                        <small>Add a patient to the queue</small>
                      </span>
                      <ArrowRight size={17} />
                    </button>

                    <button
                      className="quick-action"
                      onClick={() => openPage("Patient Queue")}
                    >
                      <span className="quick-icon purple-bg">
                        <ListOrdered />
                      </span>
                      <span>
                        <strong>Manage queue</strong>
                        <small>Review priority and status</small>
                      </span>
                      <ArrowRight size={17} />
                    </button>

                    <button
                      className="quick-action"
                      onClick={() => openPage("Staff Panel")}
                    >
                      <span className="quick-icon green-bg">
                        <Monitor />
                      </span>
                      <span>
                        <strong>Staff control panel</strong>
                        <small>Update consultations</small>
                      </span>
                      <ArrowRight size={17} />
                    </button>
                  </div>
                </section>

                <section className="notice-card">
                  <div className="notice-icon">
                    <HeartPulse size={23} />
                  </div>
                  <h3>Patient safety first</h3>
                  <p>
                    Emergency symptoms require immediate clinical assessment.
                    Never delay emergency care to complete registration.
                  </p>
                  <div className="notice-divider" />
                  <p className="notice-small">
                    Priority labels are decision-support aids. Trained staff
                    must assess patients and confirm urgency.
                  </p>
                </section>
              </div>
            </>
          )}

          {page === "Register Patient" && (
            <section className="content-card form-card">
              <div className="section-heading">
                <div>
                  <h3>Register a new patient</h3>
                  <p>Enter patient details and symptoms.</p>
                </div>
                <span className="form-step">STEP 1 OF 1</span>
              </div>

              <div className="form-info">
                <AlertCircle size={19} />
                <p>
                  If the patient appears to have a life-threatening emergency,
                  alert clinical staff immediately. Do not delay care for this form.
                </p>
              </div>

              <form onSubmit={registerPatient}>
                <div className="form-section-title">
                  <span className="form-section-number">1</span>
                  <div>
                    <h4>Patient information</h4>
                    <p>Basic details for registration</p>
                  </div>
                </div>

                <div className="form-grid">
                  <label className="field full-field">
                    Patient full name *
                    <input
                      name="name"
                      value={form.name}
                      onChange={updateField}
                      placeholder="Enter patient's full name"
                      autoComplete="name"
                      maxLength={100}
                      required
                    />
                  </label>

                  <label className="field">
                    Age *
                    <input
                      name="age"
                      type="number"
                      min="0"
                      max="125"
                      value={form.age}
                      onChange={updateField}
                      placeholder="Age in years"
                      required
                    />
                  </label>

                  <label className="field">
                    Contact number
                    <input
                      name="phone"
                      type="tel"
                      value={form.phone}
                      onChange={updateField}
                      placeholder="Optional contact number"
                      maxLength={20}
                    />
                  </label>
                </div>

                <div className="form-section-title form-section-spaced">
                  <span className="form-section-number">2</span>
                  <div>
                    <h4>Symptoms and department</h4>
                    <p>Record the reason for the visit</p>
                  </div>
                </div>

                <div className="form-grid">
                  <label className="field full-field">
                    Main symptoms or condition *
                    <textarea
                      name="symptoms"
                      value={form.symptoms}
                      onChange={updateField}
                      placeholder="Describe the patient's symptoms in simple words"
                      rows="3"
                      maxLength={1000}
                      required
                    />
                  </label>

                  <label className="field">
                    How long have symptoms been present?
                    <select
                      name="duration"
                      value={form.duration}
                      onChange={updateField}
                    >
                      <option>Just started</option>
                      <option>Less than 1 hour</option>
                      <option>2–6 hours</option>
                      <option>Since morning</option>
                      <option>Today</option>
                      <option>1–3 days</option>
                      <option>More than 3 days</option>
                    </select>
                  </label>

                  <label className="field">
                    Department
                    <select
                      name="department"
                      value={form.department}
                      onChange={updateField}
                    >
                      <option>General Medicine</option>
                      <option>Emergency</option>
                      <option>Pediatrics</option>
                      <option>Orthopedics</option>
                      <option>Other / To be decided</option>
                    </select>
                  </label>
                </div>

                <div className="form-section-title form-section-spaced">
                  <span className="form-section-number">3</span>
                  <div>
                    <h4>Staff-reviewed urgency</h4>
                    <p>Choose the level after clinical assessment</p>
                  </div>
                </div>

                <div className="urgency-options">
                  {["Emergency", "Urgent", "Routine"].map((level) => (
                    <label
                      key={level}
                      className={`urgency-option ${urgencyClass(level)} ${
                        form.urgency === level ? "selected" : ""
                      }`}
                    >
                      <input
                        type="radio"
                        name="urgency"
                        value={level}
                        checked={form.urgency === level}
                        onChange={updateField}
                      />

                      <span className="urgency-radio" />

                      <span className="urgency-copy">
                        <strong>{level}</strong>
                        <small>{priorityDescriptions[level]}</small>
                      </span>
                    </label>
                  ))}
                </div>

                <label className="field notes-field">
                  Additional notes (optional)
                  <textarea
                    name="notes"
                    value={form.notes}
                    onChange={updateField}
                    placeholder="Any additional information for healthcare staff"
                    rows="2"
                    maxLength={1000}
                  />
                </label>

                <div className="form-footer">
                  <p>* Required fields</p>

                  <div className="form-buttons">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => setForm(makeInitialForm())}
                    >
                      Clear form
                    </button>

                    <button type="submit" className="primary-button">
                      <UserPlus size={18} /> Register Patient
                    </button>
                  </div>
                </div>
              </form>
            </section>
          )}

          {page === "Patient Queue" && (
            <section className="content-card">
              <div className="section-heading queue-heading">
                <div>
                  <h3>Patient queue</h3>
                  <p>Search patients and review their status.</p>
                </div>

                <button
                  className="primary-button"
                  onClick={() => openPage("Register Patient")}
                >
                  <Plus size={18} /> Add patient
                </button>
              </div>

              <div className="queue-toolbar">
                <div className="search-box">
                  <Search size={19} />

                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search name, token or symptom..."
                    aria-label="Search patients"
                  />

                  {search && (
                    <button
                      className="icon-button"
                      onClick={() => setSearch("")}
                      aria-label="Clear search"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>

                <label className="filter-select">
                  <span>Filter:</span>
                  <select
                    value={filter}
                    onChange={(event) => setFilter(event.target.value)}
                  >
                    <option>All</option>
                    <option>Emergency</option>
                    <option>Urgent</option>
                    <option>Routine</option>
                    <option>Waiting</option>
                    <option>Called</option>
                    <option>In Consultation</option>
                    <option>Completed</option>
                  </select>
                </label>
              </div>

              <PatientTable
                patients={filteredPatients}
                onStatus={updateStatus}
              />

              {filteredPatients.length === 0 && (
                <EmptyState text="No patients found. Try another search or register a patient." />
              )}

              <div className="queue-footer">
                Showing {filteredPatients.length} of {patients.length} patients
                <span>Queue is sorted by urgency, then arrival time.</span>
              </div>
            </section>
          )}

          {page === "Staff Panel" && (
            <>
              <section className="welcome-row">
                <div>
                  <p className="eyebrow">CONSULTATION MANAGEMENT</p>
                  <h3>Manage patient flow</h3>
                  <p className="muted">
                    Call waiting patients and update their consultation status.
                  </p>
                </div>

                <button
                  className="primary-button"
                  onClick={callNextPatient}
                >
                  <Activity size={18} /> Call next patient
                </button>
              </section>

              <section className="stats-grid staff-stats">
                <StatCard
                  title="Waiting"
                  value={waitingCount}
                  detail="Awaiting staff call"
                  icon={Clock}
                  color="orange"
                />

                <StatCard
                  title="Called"
                  value={patients.filter((p) => p.status === "Called").length}
                  detail="Ready to be seen"
                  icon={Users}
                  color="blue"
                />

                <StatCard
                  title="In consultation"
                  value={inConsultationCount}
                  detail="Currently being seen"
                  icon={Stethoscope}
                  color="purple"
                />

                <StatCard
                  title="Completed"
                  value={completedCount}
                  detail="Finished consultations"
                  icon={CheckCircle2}
                  color="green"
                />
              </section>

              <section className="content-card">
                <div className="section-heading">
                  <div>
                    <h3>Staff action list</h3>
                    <p>Use the buttons to record each step of care.</p>
                  </div>
                </div>

                <PatientTable
                  patients={sortedPatients}
                  onStatus={updateStatus}
                />

                {sortedPatients.length === 0 && (
                  <EmptyState text="No patients registered yet." />
                )}
              </section>
            </>
          )}

          <footer className="page-footer">
            <span>
              <HeartPulse size={16} /> SmartCare Patient Queue
            </span>
            <span>Hackathon demonstration · Not for clinical decision-making</span>
          </footer>
        </div>
      </main>
    </div>
  );
}

function StatCard({ title, value, detail, icon: Icon, color }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${color}`}>
        <Icon size={22} />
      </div>
      <div className="stat-title">{title}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-detail">{detail}</div>
    </div>
  );
}

function PatientTable({ patients, onStatus }) {
  if (patients.length === 0) return null;

  return (
    <div className="table-wrap">
      <table className="patient-table">
        <thead>
          <tr>
            <th>Patient / Token</th>
            <th>Symptoms</th>
            <th>Urgency</th>
            <th>Arrival</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          {patients.map((patient) => (
            <tr key={patient.id}>
              <td>
                <div className="patient-name">{patient.name}</div>
                <div className="patient-token">
                  {patient.id} · Age {patient.age}
                </div>
              </td>

              <td>
                <div className="symptom-text">{patient.symptoms}</div>
                <div className="patient-token">{patient.department}</div>
              </td>

              <td>
                <PriorityBadge urgency={patient.urgency} />
              </td>

              <td className="arrival-cell">
                {formatTime(patient.createdAt)}
              </td>

              <td>
                <StatusBadge status={patient.status} />
              </td>

              <td>
                <div className="table-actions">
                  {patient.status === "Waiting" && (
                    <button
                      className="small-action call-action"
                      onClick={() => onStatus(patient.id, "Called")}
                    >
                      Call
                    </button>
                  )}

                  {patient.status === "Called" && (
                    <button
                      className="small-action start-action"
                      onClick={() =>
                        onStatus(patient.id, "In Consultation")
                      }
                    >
                      Start
                    </button>
                  )}

                  {patient.status === "In Consultation" && (
                    <button
                      className="small-action complete-action"
                      onClick={() => onStatus(patient.id, "Completed")}
                    >
                      <Check size={14} /> Complete
                    </button>
                  )}

                  {patient.status === "Completed" && (
                    <span className="done-label">
                      <CheckCircle2 size={15} /> Done
                    </span>
                  )}

                  {patient.status === "Called" && (
                    <button
                      className="icon-button return-button"
                      title="Return to waiting"
                      aria-label="Return patient to waiting queue"
                      onClick={() => onStatus(patient.id, "Waiting")}
                    >
                      <Clock size={15} />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Users size={26} />
      </div>
      <p>{text}</p>
    </div>
  );
}