'use client';

import { FormEvent, useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import { supabase } from '@/lib/supabase';

type Project = {
  id: string;
  client_name: string;
  project_name: string;
  target_start_date: string | null;
};

type Job = {
  id: string;
  title: string;
  project_id: string | null;
  max_notice_period_days: number | null;
  open_positions: number | null;
  status: string | null;
  projects?: { client_name: string; project_name: string } | { client_name: string; project_name: string }[] | null;
};

function projectLabel(job: Job) {
  const project = Array.isArray(job.projects) ? job.projects[0] : job.projects;
  return project ? `${project.client_name} · ${project.project_name}` : 'Unlinked';
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectModal, setProjectModal] = useState(false);
  const [jobModal, setJobModal] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const [{ data: projectRows }, { data: jobRows }] = await Promise.all([
      supabase
        .from('projects')
        .select('id, client_name, project_name, target_start_date')
        .order('target_start_date', { ascending: true }),
      supabase
        .from('jobs')
        .select('id, title, project_id, max_notice_period_days, open_positions, status, projects(client_name, project_name)')
        .eq('status', 'open')
        .order('title', { ascending: true }),
    ]);
    setProjects(projectRows || []);
    setJobs((jobRows as Job[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function createProject(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const data = new FormData(e.currentTarget);
    const { error } = await supabase.from('projects').insert([
      {
        client_name: String(data.get('client_name') || '').trim(),
        project_name: String(data.get('project_name') || '').trim(),
        target_start_date: String(data.get('target_start_date') || '') || null,
      },
    ]);
    setSaving(false);
    if (error) {
      alert('Unable to create project: ' + error.message);
      return;
    }
    setProjectModal(false);
    await load();
  }

  async function createJob(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const data = new FormData(e.currentTarget);
    const { error } = await supabase.from('jobs').insert([
      {
        title: String(data.get('title') || '').trim(),
        project_id: String(data.get('project_id') || '') || null,
        max_notice_period_days: Number(data.get('max_notice_period_days') || 0),
        open_positions: Number(data.get('open_positions') || 1),
        status: 'open',
      },
    ]);
    setSaving(false);
    if (error) {
      alert('Unable to create job: ' + error.message);
      return;
    }
    setJobModal(false);
    await load();
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-6xl mx-auto py-8 px-4 space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Projects & Jobs</h1>
            <p className="text-sm text-gray-600">
              Client projects and open roles. Notice-period caps on each job drive candidate eligibility.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setProjectModal(true)}
              className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-900 font-medium px-4 py-2 rounded-md transition"
            >
              + Client Project
            </button>
            <button
              type="button"
              onClick={() => setJobModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-md transition"
            >
              + Job Role
            </button>
          </div>
        </div>

        {loading ? (
          <p className="text-gray-500">Loading projects and open positions...</p>
        ) : (
          <>
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">
                Active client projects
              </h2>
              {projects.length === 0 ? (
                <p className="text-sm text-gray-500 bg-white border rounded-xl p-6">
                  No projects yet. Create a client project to attach job roles.
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {projects.map((project) => (
                    <article
                      key={project.id}
                      className="bg-white border rounded-xl p-4 shadow-sm"
                    >
                      <p className="text-xs uppercase tracking-wide text-gray-500">
                        {project.client_name}
                      </p>
                      <h3 className="text-lg font-semibold text-gray-900 mt-1">
                        {project.project_name}
                      </h3>
                      <p className="text-sm text-gray-600 mt-2">
                        Target start:{' '}
                        {project.target_start_date || 'Not set'}
                      </p>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">
                Open job positions
              </h2>
              <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50 text-gray-700 font-semibold">
                    <tr>
                      <th className="px-4 py-3 text-left">Role</th>
                      <th className="px-4 py-3 text-left">Client / Project</th>
                      <th className="px-4 py-3 text-left">Max notice</th>
                      <th className="px-4 py-3 text-left">Openings</th>
                      <th className="px-4 py-3 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 text-gray-800">
                    {jobs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                          No open jobs. Create a job role against a client project.
                        </td>
                      </tr>
                    ) : (
                      jobs.map((job) => (
                        <tr key={job.id}>
                          <td className="px-4 py-3 font-medium text-gray-900">{job.title}</td>
                          <td className="px-4 py-3">{projectLabel(job)}</td>
                          <td className="px-4 py-3">{job.max_notice_period_days ?? '—'} days</td>
                          <td className="px-4 py-3">{job.open_positions ?? 0}</td>
                          <td className="px-4 py-3">
                            <span className="bg-green-50 text-green-800 px-2 py-1 rounded text-xs font-semibold">
                              {job.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>

      {projectModal && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-black/40 p-4">
          <form
            onSubmit={createProject}
            className="w-full max-w-md space-y-3 rounded-xl bg-white p-5"
          >
            <h2 className="text-lg font-semibold text-gray-900">New client project</h2>
            <label className="block text-sm text-gray-700">
              Client name
              <input
                name="client_name"
                required
                className="mt-1 w-full border rounded-md p-2 text-black"
              />
            </label>
            <label className="block text-sm text-gray-700">
              Project name
              <input
                name="project_name"
                required
                className="mt-1 w-full border rounded-md p-2 text-black"
              />
            </label>
            <label className="block text-sm text-gray-700">
              Target start date
              <input
                name="target_start_date"
                type="date"
                required
                className="mt-1 w-full border rounded-md p-2 text-black"
              />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setProjectModal(false)} className="px-3 py-2 text-sm">
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white"
              >
                {saving ? 'Saving...' : 'Create project'}
              </button>
            </div>
          </form>
        </div>
      )}

      {jobModal && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-black/40 p-4">
          <form onSubmit={createJob} className="w-full max-w-md space-y-3 rounded-xl bg-white p-5">
            <h2 className="text-lg font-semibold text-gray-900">New job role</h2>
            <label className="block text-sm text-gray-700">
              Title
              <input name="title" required className="mt-1 w-full border rounded-md p-2 text-black" />
            </label>
            <label className="block text-sm text-gray-700">
              Project
              <select
                name="project_id"
                required
                className="mt-1 w-full border rounded-md p-2 text-black"
              >
                <option value="">Select project</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.client_name} · {project.project_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm text-gray-700">
              Max notice period (days)
              <input
                name="max_notice_period_days"
                type="number"
                min={0}
                required
                className="mt-1 w-full border rounded-md p-2 text-black"
              />
            </label>
            <label className="block text-sm text-gray-700">
              Open positions
              <input
                name="open_positions"
                type="number"
                min={1}
                defaultValue={1}
                required
                className="mt-1 w-full border rounded-md p-2 text-black"
              />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setJobModal(false)} className="px-3 py-2 text-sm">
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white"
              >
                {saving ? 'Saving...' : 'Create job'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
