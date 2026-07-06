import React, { useEffect, useState } from "react";
import {
  getPuestos,
  createPuesto,
  updatePuesto,
  getPersonas,
  createPersona,
  updatePersona,
  getPersonaRoles,
  createPersonaRole,
  updatePersonaRole,
  getUsuarios,
  createUsuario,
  updateUsuario,
  updateUsuarioPermisos,
  getRolesPermisos,
  createRolPermisos,
  updateRolPermisos,
} from "../../services/organizationCatalogService";

const TABS = [
  { id: "puestos", label: "Puestos" },
  { id: "personas", label: "Personas" },
  { id: "roles", label: "Roles" },
  { id: "usuarios", label: "Usuarios" },
];

const EMPTY_PUESTO = {
  nombre: "",
  area: "",
  proceso: "",
  nivel: "",
  activo: true,
};

const EMPTY_PERSONA = {
  nombre: "",
  puesto: "",
  area: "",
  proceso: "",
  tipo: "persona",
  activo: true,
};

const EMPTY_ROL = {
  persona_id: "",
  rol: "",
  proceso: "",
  activo: true,
};

const EMPTY_USUARIO = {
  usuario: "",
  nombre: "",
  puesto: "",
  rol_sistema: "Usuario",
  rol_organizacional: "",
  password_hash: "",
  persona_id: "",
  activo: true,
};

// Módulos del menú (ver Sidebar.jsx) sobre los que se puede dar una excepción
// de permisos a un usuario puntual. `editable: true` solo en los dos módulos
// donde hoy existe un candado de edición real (ver permissionsService.js);
// en el resto, un checkbox de "editar" no bloquearía nada todavía.
const PERMISSION_MODULES = [
  { key: "home", label: "Inicio Ejecutivo", editable: false },
  { key: "performance", label: "Desempeño Organizacional", editable: false },
  { key: "strategic-followup", label: "Seguimiento Estratégico", editable: false },
  { key: "strategic-deployment", label: "Despliegue Estratégico", editable: false },
  { key: "capacity", label: "Diseño Organizacional", editable: true },
  { key: "workload-balance", label: "Balance de Carga", editable: true },
  { key: "decision-center", label: "Centro de Decisiones", editable: false },
  { key: "maturity", label: "Madurez Organizacional", editable: false },
  { key: "sig", label: "Diagnóstico SIG", editable: false },
  { key: "organization-catalog", label: "Catálogo Organizacional", editable: false },
];

function buildPermisosDraft(permisosCustom) {
  const draft = {};

  PERMISSION_MODULES.forEach(({ key }) => {
    const override = permisosCustom?.[key];
    draft[key] = {
      visible: typeof override?.visible === "boolean" ? String(override.visible) : "default",
      editar: typeof override?.editar === "boolean" ? String(override.editar) : "default",
    };
  });

  return draft;
}

function serializePermisosDraft(draft) {
  const result = {};

  PERMISSION_MODULES.forEach(({ key }) => {
    const entry = draft[key] || {};
    const moduleOverride = {};

    if (entry.visible === "true" || entry.visible === "false") {
      moduleOverride.visible = entry.visible === "true";
    }

    if (entry.editar === "true" || entry.editar === "false") {
      moduleOverride.editar = entry.editar === "true";
    }

    if (Object.keys(moduleOverride).length > 0) {
      result[key] = moduleOverride;
    }
  });

  return Object.keys(result).length > 0 ? result : null;
}

export default function OrganizationCatalogModule() {
  const [activeTab, setActiveTab] = useState("puestos");

  const [puestos, setPuestos] = useState([]);
  const [personas, setPersonas] = useState([]);
  const [roles, setRoles] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [rolesPermisos, setRolesPermisos] = useState([]);

  const [puestoForm, setPuestoForm] = useState(EMPTY_PUESTO);
  const [personaForm, setPersonaForm] = useState(EMPTY_PERSONA);
  const [rolForm, setRolForm] = useState(EMPTY_ROL);
  const [usuarioForm, setUsuarioForm] = useState(EMPTY_USUARIO);

  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [permisosUser, setPermisosUser] = useState(null);
  const [permisosDraft, setPermisosDraft] = useState({});
  const [savingPermisos, setSavingPermisos] = useState(false);

  const [permisosRol, setPermisosRol] = useState(null);
  const [permisosRolDraft, setPermisosRolDraft] = useState({});
  const [savingPermisosRol, setSavingPermisosRol] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    loadCatalog();
  }, []);

  async function loadCatalog() {
    try {
      setLoading(true);
      setError("");

      const results = await Promise.allSettled([
        getPuestos(),
        getPersonas(),
        getPersonaRoles(),
        getUsuarios(),
        getRolesPermisos(),
      ]);

      if (results[0].status === "fulfilled") setPuestos(results[0].value || []);
      if (results[1].status === "fulfilled") setPersonas(results[1].value || []);
      if (results[2].status === "fulfilled") setRoles(results[2].value || []);
      if (results[3].status === "fulfilled") setUsuarios(results[3].value || []);
      if (results[4].status === "fulfilled") setRolesPermisos(results[4].value || []);

      const errores = results
        .filter((result) => result.status === "rejected")
        .map((result) => result.reason?.message)
        .filter(Boolean);

      if (errores.length > 0) setError(errores.join(" | "));
    } catch (err) {
      setError(err.message || "Error al cargar el Catálogo Organizacional.");
    } finally {
      setLoading(false);
    }
  }

  function resetForms() {
    setPuestoForm(EMPTY_PUESTO);
    setPersonaForm(EMPTY_PERSONA);
    setRolForm(EMPTY_ROL);
    setUsuarioForm(EMPTY_USUARIO);
    setError("");
    setSuccess("");
  }

  function handleTabChange(tabId) {
    setActiveTab(tabId);
    setModalOpen(false);
    resetForms();
  }

  function getActiveTabLabel() {
    return TABS.find((tab) => tab.id === activeTab)?.label || "";
  }

  function getPersonaName(personaId) {
    const persona = personas.find((p) => String(p.id) === String(personaId));
    return persona?.nombre || "Sin persona";
  }

  const personasVinculables = personas
    .filter((persona) => persona.tipo === "persona" && persona.activo !== false)
    .sort((a, b) => String(a.nombre || "").localeCompare(String(b.nombre || "")));

  function getUniquePuestos() {
    const seen = new Set();

    return puestos.filter((puesto) => {
      const key = `${puesto.nombre || ""}|${puesto.area || ""}|${puesto.proceso || ""}|${puesto.nivel || ""}`;

      if (seen.has(key)) return false;

      seen.add(key);
      return true;
    });
  }

  async function saveNewRecord(e) {
    e.preventDefault();

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      if (activeTab === "puestos") await createPuesto(puestoForm);
      if (activeTab === "personas") await createPersona(personaForm);
      if (activeTab === "roles") await createPersonaRole(rolForm);
      if (activeTab === "usuarios") await createUsuario(usuarioForm);

      setSuccess("Registro agregado correctamente.");
      setModalOpen(false);
      resetForms();
      await loadCatalog();
    } catch (err) {
      setError(err.message || "Error al agregar el registro.");
    } finally {
      setSaving(false);
    }
  }

  async function updateCell(section, record, field, value) {
    if (String(record[field] || "") === String(value || "")) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const payload = {
        ...record,
        [field]: value,
      };

      if (section === "puestos") await updatePuesto(record.id, payload);
      if (section === "personas") await updatePersona(record.id, payload);
      if (section === "roles") await updatePersonaRole(record.id, payload);
      if (section === "usuarios") await updateUsuario(record.id, payload);

      setSuccess("Campo actualizado correctamente.");
      await loadCatalog();
    } catch (err) {
      setError(err.message || "Error al actualizar el campo.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActivo(record) {
    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const payload = {
        ...record,
        activo: !record.activo,
      };

      if (activeTab === "puestos") await updatePuesto(record.id, payload);
      if (activeTab === "personas") await updatePersona(record.id, payload);
      if (activeTab === "roles") await updatePersonaRole(record.id, payload);
      if (activeTab === "usuarios") await updateUsuario(record.id, payload);

      setSuccess(
        record.activo
          ? "Registro inactivado correctamente."
          : "Registro activado correctamente."
      );

      await loadCatalog();
    } catch (err) {
      setError(err.message || "Error al cambiar el estatus.");
    } finally {
      setSaving(false);
    }
  }

  function openPermisosModal(item) {
    setPermisosUser(item);
    setPermisosDraft(buildPermisosDraft(item.permisos_custom));
    setError("");
    setSuccess("");
  }

  function closePermisosModal() {
    setPermisosUser(null);
    setPermisosDraft({});
  }

  function updatePermisosDraftField(moduleKey, field, value) {
    setPermisosDraft((current) => ({
      ...current,
      [moduleKey]: { ...current[moduleKey], [field]: value },
    }));
  }

  async function savePermisos() {
    if (!permisosUser) return;

    try {
      setSavingPermisos(true);
      setError("");
      setSuccess("");

      const permisosCustom = serializePermisosDraft(permisosDraft);
      await updateUsuarioPermisos(permisosUser.id, permisosCustom);

      setSuccess(`Permisos de "${permisosUser.usuario}" actualizados correctamente.`);
      closePermisosModal();
      await loadCatalog();
    } catch (err) {
      setError(err.message || "Error al guardar los permisos del usuario.");
    } finally {
      setSavingPermisos(false);
    }
  }

  // Roles que realmente aplican a un usuario: su rol de cuenta, más todos los
  // roles operativos activos de la persona vinculada (pestaña Roles).
  function getRolesForUsuario(item) {
    const applicableRoles = new Set();

    if (item.rol_organizacional) applicableRoles.add(item.rol_organizacional);

    if (item.persona_id) {
      roles
        .filter((r) => String(r.persona_id) === String(item.persona_id) && r.activo !== false)
        .forEach((r) => {
          if (r.rol) applicableRoles.add(r.rol);
        });
    }

    return Array.from(applicableRoles);
  }

  function openPermisosRolModal(rolNombre) {
    const existing = rolesPermisos.find((r) => r.rol === rolNombre);
    setPermisosRol({ rol: rolNombre, id: existing?.id || null });
    setPermisosRolDraft(buildPermisosDraft(existing?.permisos));
    setError("");
    setSuccess("");
  }

  function closePermisosRolModal() {
    setPermisosRol(null);
    setPermisosRolDraft({});
  }

  function updatePermisosRolDraftField(moduleKey, field, value) {
    setPermisosRolDraft((current) => ({
      ...current,
      [moduleKey]: { ...current[moduleKey], [field]: value },
    }));
  }

  async function savePermisosRol() {
    if (!permisosRol) return;

    try {
      setSavingPermisosRol(true);
      setError("");
      setSuccess("");

      const permisos = serializePermisosDraft(permisosRolDraft) || {};

      if (permisosRol.id) {
        await updateRolPermisos(permisosRol.id, permisos);
      } else {
        const created = await createRolPermisos(permisosRol.rol);
        await updateRolPermisos(created.id, permisos);
      }

      setSuccess(`Permisos por defecto del rol "${permisosRol.rol}" actualizados correctamente.`);
      closePermisosRolModal();
      await loadCatalog();
    } catch (err) {
      setError(err.message || "Error al guardar los permisos del rol.");
    } finally {
      setSavingPermisosRol(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
          <div className="flex flex-wrap gap-2">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabChange(tab.id)}
                className={`rounded-xl px-5 py-3 text-sm font-semibold transition ${
                  activeTab === tab.id
                    ? "bg-slate-900 text-white"
                    : "bg-white text-slate-600 hover:bg-slate-100"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </section>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
            {success}
          </div>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-200 p-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-black text-slate-900">
                {getActiveTabLabel()}
              </h2>
              <p className="text-sm text-slate-500">
                Edita directamente las celdas de la tabla.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={loadCatalog}
                disabled={loading}
                className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
              >
                {loading ? "Actualizando..." : "Actualizar"}
              </button>

              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-red-700"
              >
                + Agregar
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            {activeTab === "puestos" && (
              <table className="min-w-full divide-y divide-slate-200">
                <TableHead
                  headers={["Nombre", "Proceso", "Nivel", "Estatus", "Acciones"]}
                />
                <tbody className="divide-y divide-slate-100 bg-white">
                  {getUniquePuestos().map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <EditableCell
                        value={item.nombre}
                        onSave={(value) => updateCell("puestos", item, "nombre", value)}
                      />
                      <EditableCell
                        value={item.proceso}
                        onSave={(value) => updateCell("puestos", item, "proceso", value)}
                      />
                      <EditableCell
                        value={item.nivel}
                        onSave={(value) => updateCell("puestos", item, "nivel", value)}
                      />
                      <td className="px-5 py-2 text-sm">
                        <StatusBadge active={item.activo} />
                      </td>
                      <td className="px-5 py-2 text-sm">
                        <ActionButton item={item} onToggle={toggleActivo} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {activeTab === "personas" && (
              <table className="min-w-full divide-y divide-slate-200">
                <TableHead
                  headers={[
                    "Nombre",
                    "Puesto",
                    "Proceso",
                    "Tipo",
                    "Estatus",
                    "Acciones",
                  ]}
                />
                <tbody className="divide-y divide-slate-100 bg-white">
                  {personas.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <EditableCell
                        value={item.nombre}
                        onSave={(value) => updateCell("personas", item, "nombre", value)}
                      />
                      <EditableCell
                        value={item.puesto}
                        onSave={(value) => updateCell("personas", item, "puesto", value)}
                      />
                      <EditableCell
                        value={item.proceso}
                        onSave={(value) => updateCell("personas", item, "proceso", value)}
                      />
                      <EditableCell
                        value={item.tipo}
                        onSave={(value) => updateCell("personas", item, "tipo", value)}
                      />
                      <td className="px-5 py-2 text-sm">
                        <StatusBadge active={item.activo} />
                      </td>
                      <td className="px-5 py-2 text-sm">
                        <ActionButton item={item} onToggle={toggleActivo} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {activeTab === "roles" && (
              <table className="min-w-full divide-y divide-slate-200">
                <TableHead
                  headers={["Persona", "Rol", "Proceso", "Estatus", "Acciones"]}
                />
                <tbody className="divide-y divide-slate-100 bg-white">
                  {roles.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-5 py-2 text-sm text-slate-700">
                        {getPersonaName(item.persona_id)}
                      </td>
                      <EditableCell
                        value={item.rol}
                        onSave={(value) => updateCell("roles", item, "rol", value)}
                      />
                      <EditableCell
                        value={item.proceso}
                        onSave={(value) => updateCell("roles", item, "proceso", value)}
                      />
                      <td className="px-5 py-2 text-sm">
                        <StatusBadge active={item.activo} />
                      </td>
                      <td className="px-5 py-2 text-sm">
                        <ActionButton item={item} onToggle={toggleActivo} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {activeTab === "usuarios" && (
              <table className="min-w-full divide-y divide-slate-200">
                <TableHead
                  headers={[
                    "Usuario",
                    "Nombre",
                    "Puesto",
                    "Rol sistema",
                    "Persona vinculada",
                    "Estatus",
                    "Acciones",
                  ]}
                />
                <tbody className="divide-y divide-slate-100 bg-white">
                  {usuarios.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <EditableCell
                        value={item.usuario}
                        onSave={(value) => updateCell("usuarios", item, "usuario", value)}
                      />
                      <EditableCell
                        value={item.nombre}
                        onSave={(value) => updateCell("usuarios", item, "nombre", value)}
                      />
                      <EditableCell
                        value={item.puesto}
                        onSave={(value) => updateCell("usuarios", item, "puesto", value)}
                      />
                      <EditableCell
                        value={item.rol_sistema}
                        onSave={(value) =>
                          updateCell("usuarios", item, "rol_sistema", value)
                        }
                      />
                      <td className="px-5 py-2 text-sm">
                        <select
                          value={item.persona_id || ""}
                          onChange={(e) => updateCell("usuarios", item, "persona_id", e.target.value || null)}
                          className="w-full min-w-[180px] rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-slate-400"
                        >
                          <option value="">Sin vincular</option>
                          {personasVinculables.map((persona) => (
                            <option key={persona.id} value={persona.id}>
                              {persona.nombre}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-5 py-2 text-sm">
                        <StatusBadge active={item.activo} />
                      </td>
                      <td className="px-5 py-2 text-sm">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => openPermisosModal(item)}
                            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                          >
                            Permisos
                          </button>
                          <ActionButton item={item} onToggle={toggleActivo} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

          </div>
        </section>

        {modalOpen && (
          <Modal
            title="Agregar registro"
            subtitle={getActiveTabLabel()}
            onClose={() => {
              setModalOpen(false);
              resetForms();
            }}
          >
            <form onSubmit={saveNewRecord} className="space-y-4">
              {activeTab === "puestos" && (
                <>
                  <Input label="Nombre" value={puestoForm.nombre} onChange={(value) => setPuestoForm({ ...puestoForm, nombre: value })} required />
                  <Input label="Área" value={puestoForm.area} onChange={(value) => setPuestoForm({ ...puestoForm, area: value })} />
                  <Input label="Proceso" value={puestoForm.proceso} onChange={(value) => setPuestoForm({ ...puestoForm, proceso: value })} />
                  <Input label="Nivel" value={puestoForm.nivel} onChange={(value) => setPuestoForm({ ...puestoForm, nivel: value })} />
                  <Switch value={puestoForm.activo} onChange={(value) => setPuestoForm({ ...puestoForm, activo: value })} />
                </>
              )}

              {activeTab === "personas" && (
                <>
                  <Input label="Nombre" value={personaForm.nombre} onChange={(value) => setPersonaForm({ ...personaForm, nombre: value })} required />
                  <Input label="Puesto" value={personaForm.puesto} onChange={(value) => setPersonaForm({ ...personaForm, puesto: value })} />
                  <Input label="Área" value={personaForm.area} onChange={(value) => setPersonaForm({ ...personaForm, area: value })} />
                  <Input label="Proceso" value={personaForm.proceso} onChange={(value) => setPersonaForm({ ...personaForm, proceso: value })} />
                  <Input label="Tipo" value={personaForm.tipo} onChange={(value) => setPersonaForm({ ...personaForm, tipo: value })} />
                  <Switch value={personaForm.activo} onChange={(value) => setPersonaForm({ ...personaForm, activo: value })} />
                </>
              )}

              {activeTab === "roles" && (
                <>
                  <Select label="Persona" value={rolForm.persona_id} onChange={(value) => setRolForm({ ...rolForm, persona_id: value })} required>
                    <option value="">Seleccionar persona</option>
                    {personas.map((persona) => (
                      <option key={persona.id} value={persona.id}>
                        {persona.nombre}
                      </option>
                    ))}
                  </Select>
                  <Input label="Rol organizacional" value={rolForm.rol} onChange={(value) => setRolForm({ ...rolForm, rol: value })} required />
                  <Input label="Proceso" value={rolForm.proceso} onChange={(value) => setRolForm({ ...rolForm, proceso: value })} />
                  <Switch value={rolForm.activo} onChange={(value) => setRolForm({ ...rolForm, activo: value })} />
                </>
              )}

              {activeTab === "usuarios" && (
                <>
                  <Input label="Usuario" value={usuarioForm.usuario} onChange={(value) => setUsuarioForm({ ...usuarioForm, usuario: value })} required />
                  <Input label="Contraseña" type="password" value={usuarioForm.password_hash} onChange={(value) => setUsuarioForm({ ...usuarioForm, password_hash: value })} required />
                  <Input label="Nombre" value={usuarioForm.nombre} onChange={(value) => setUsuarioForm({ ...usuarioForm, nombre: value })} required />
                  <Input label="Puesto" value={usuarioForm.puesto} onChange={(value) => setUsuarioForm({ ...usuarioForm, puesto: value })} />
                  <Input label="Rol sistema" value={usuarioForm.rol_sistema} onChange={(value) => setUsuarioForm({ ...usuarioForm, rol_sistema: value })} />
                  <Select label="Persona vinculada" value={usuarioForm.persona_id} onChange={(value) => setUsuarioForm({ ...usuarioForm, persona_id: value })}>
                    <option value="">Sin vincular</option>
                    {personasVinculables.map((persona) => (
                      <option key={persona.id} value={persona.id}>
                        {persona.nombre}
                      </option>
                    ))}
                  </Select>
                  <Switch value={usuarioForm.activo} onChange={(value) => setUsuarioForm({ ...usuarioForm, activo: value })} />
                </>
              )}

              <div className="flex justify-end gap-3 border-t border-slate-200 pt-5">
                <button
                  type="button"
                  onClick={() => {
                    setModalOpen(false);
                    resetForms();
                  }}
                  className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-60"
                >
                  {saving ? "Guardando..." : "Agregar"}
                </button>
              </div>
            </form>
          </Modal>
        )}

        {permisosUser && (
          <Modal
            title="Permisos personalizados"
            subtitle={`${permisosUser.nombre || permisosUser.usuario} · excepción sobre los permisos por rol`}
            onClose={closePermisosModal}
          >
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-black uppercase tracking-widest text-slate-400">Roles de este usuario</div>
                <p className="mt-1 text-sm text-slate-500">
                  Cada uno de estos roles trae su propio permiso por defecto. Edítalo aquí y aplicará a{" "}
                  <span className="font-semibold text-slate-700">todos</span> los usuarios que tengan ese mismo rol,
                  no solo a este.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {getRolesForUsuario(permisosUser).map((rolNombre) => (
                    <button
                      key={rolNombre}
                      type="button"
                      onClick={() => openPermisosRolModal(rolNombre)}
                      className="rounded-full border border-slate-300 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 hover:border-slate-400 hover:bg-slate-100"
                    >
                      {rolNombre} · editar valores por defecto
                    </button>
                  ))}
                  {getRolesForUsuario(permisosUser).length === 0 && (
                    <span className="text-xs text-slate-400">
                      Este usuario no tiene rol organizacional ni persona vinculada con roles todavía.
                    </span>
                  )}
                </div>
              </div>

              <p className="text-sm text-slate-500">
                Y aquí, una excepción que aplica <span className="font-semibold text-slate-700">solo a este usuario</span>,
                por encima de lo que digan sus roles.
              </p>

              <PermisosGrid draft={permisosDraft} onChange={updatePermisosDraftField} />

              <div className="flex justify-end gap-3 border-t border-slate-200 pt-5">
                <button
                  type="button"
                  onClick={closePermisosModal}
                  className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={savePermisos}
                  disabled={savingPermisos}
                  className="rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-60"
                >
                  {savingPermisos ? "Guardando..." : "Guardar permisos"}
                </button>
              </div>
            </div>
          </Modal>
        )}

        {permisosRol && (
          <Modal
            title="Permisos por defecto del rol"
            subtitle={`${permisosRol.rol} · aplica a todos los usuarios con este rol, salvo excepción puntual`}
            onClose={closePermisosRolModal}
          >
            <div className="space-y-4">
              <p className="text-sm text-slate-500">
                Esto define lo que ve y puede editar cualquier usuario con el rol{" "}
                <span className="font-semibold text-slate-700">{permisosRol.rol}</span> (sea su rol de cuenta o un
                rol operativo de su persona vinculada), salvo que ese usuario tenga una excepción propia.
              </p>

              <PermisosGrid draft={permisosRolDraft} onChange={updatePermisosRolDraftField} />

              <div className="flex justify-end gap-3 border-t border-slate-200 pt-5">
                <button
                  type="button"
                  onClick={closePermisosRolModal}
                  className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={savePermisosRol}
                  disabled={savingPermisosRol}
                  className="rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-60"
                >
                  {savingPermisosRol ? "Guardando..." : "Guardar permisos"}
                </button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </div>
  );
}

function PermisosGrid({ draft, onChange }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200">
        <TableHead headers={["Módulo", "Visible", "Editar"]} />
        <tbody className="divide-y divide-slate-100 bg-white">
          {PERMISSION_MODULES.map((module) => (
            <tr key={module.key}>
              <td className="px-5 py-2 text-sm font-semibold text-slate-700">{module.label}</td>
              <td className="px-5 py-2 text-sm">
                <select
                  value={draft[module.key]?.visible || "default"}
                  onChange={(e) => onChange(module.key, "visible", e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none focus:border-slate-900"
                >
                  <option value="default">Sin excepción (valor por defecto)</option>
                  <option value="true">Sí, mostrar siempre</option>
                  <option value="false">No, ocultar siempre</option>
                </select>
              </td>
              <td className="px-5 py-2 text-sm">
                {module.editable ? (
                  <select
                    value={draft[module.key]?.editar || "default"}
                    onChange={(e) => onChange(module.key, "editar", e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none focus:border-slate-900"
                  >
                    <option value="default">Sin excepción (valor por defecto)</option>
                    <option value="true">Sí, puede editar</option>
                    <option value="false">No, solo lectura</option>
                  </select>
                ) : (
                  <span className="text-xs text-slate-400">No aplica todavía</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TableHead({ headers }) {
  return (
    <thead className="bg-slate-900">
      <tr>
        {headers.map((header) => (
          <th
            key={header}
            className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-white"
          >
            {header}
          </th>
        ))}
      </tr>
    </thead>
  );
}

function EditableCell({ value, onSave }) {
  const [localValue, setLocalValue] = useState(value || "");

  useEffect(() => {
    setLocalValue(value || "");
  }, [value]);

  return (
    <td className="px-5 py-2 text-sm text-slate-700">
      <input
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={() => onSave(localValue)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.currentTarget.blur();
          }
        }}
        className="w-full min-w-[140px] rounded-lg border border-transparent bg-transparent px-2 py-1 outline-none transition hover:border-slate-200 hover:bg-white focus:border-slate-300 focus:bg-white"
      />
    </td>
  );
}

function ActionButton({ item, onToggle }) {
  return (
    <button
      type="button"
      onClick={() => onToggle(item)}
      className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700"
    >
      {item.activo ? "Inactivar" : "Activar"}
    </button>
  );
}

function Modal({ title, subtitle, children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-6">
          <div>
            <h3 className="text-2xl font-black text-slate-900">{title}</h3>
            <p className="text-sm text-slate-500">{subtitle}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100"
          >
            ×
          </button>
        </div>

        <div className="max-h-[75vh] overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}

function Input({ label, value, onChange, required = false, type = "text", suggestions, helpText }) {
  const listId = suggestions ? `${label.replace(/\s+/g, "-").toLowerCase()}-suggestions` : undefined;

  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-slate-700">
        {label}
      </span>
      <input
        type={type}
        value={value || ""}
        required={required}
        list={listId}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
      />
      {helpText && <span className="mt-1 block text-xs text-slate-400">{helpText}</span>}
      {suggestions && (
        <datalist id={listId}>
          {suggestions.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
      )}
    </label>
  );
}

function Select({ label, value, onChange, children, required = false }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-slate-700">
        {label}
      </span>
      <select
        value={value || ""}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
      >
        {children}
      </select>
    </label>
  );
}

function Switch({ value, onChange }) {
  return (
    <label className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <span className="text-sm font-semibold text-slate-700">Activo</span>
      <input
        type="checkbox"
        checked={Boolean(value)}
        onChange={(e) => onChange(e.target.checked)}
        className="h-5 w-5 accent-red-600"
      />
    </label>
  );
}

function StatusBadge({ active }) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
        active
          ? "bg-emerald-100 text-emerald-700"
          : "bg-slate-200 text-slate-600"
      }`}
    >
      {active ? "Activo" : "Inactivo"}
    </span>
  );
}