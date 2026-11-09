import { useState } from 'react';
import {
  ActionIcon,
  Anchor,
  Badge,
  Button,
  Checkbox,
  Group,
  NumberInput,
  Paper,
  Stack,
  TagsInput,
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { Icon } from '@/components/Icon';
import { openModal } from '@/components/modal';
import { fmtDate, fromInput, toInputDate } from '@/lib/format';
import { confirm } from '@/lib/ui';
import { emailValidator, required } from '@/lib/validators';
import type { Experience, Hobby, Person, PersonalProject, ScholarHistory, Skill } from '@/types';

function SectionHeader({ title, onAdd, onEdit }: { title: string; onAdd?: () => void; onEdit?: () => void }) {
  return (
    <Group justify="space-between" mb="sm">
      <Title order={4}>{title}</Title>
      <Group gap={4}>
        {onAdd && (
          <ActionIcon variant="default" onClick={onAdd} aria-label={`add ${title}`}>
            <Icon icon="plus" />
          </ActionIcon>
        )}
        {onEdit && (
          <ActionIcon variant="default" onClick={onEdit} aria-label={`edit ${title}`}>
            <Icon icon="edit" />
          </ActionIcon>
        )}
      </Group>
    </Group>
  );
}

function ItemActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <Group gap={0}>
      <ActionIcon variant="subtle" color="red" onClick={onDelete} aria-label="delete">
        <Icon icon="trash" />
      </ActionIcon>
      <ActionIcon variant="subtle" onClick={onEdit} aria-label="edit">
        <Icon icon="edit" />
      </ActionIcon>
    </Group>
  );
}

const period = (from: unknown, to: unknown, current: boolean) =>
  `${fmtDate(from as string)} - ${current ? 'Now' : fmtDate(to as string)}`;

const askDelete = () => confirm('Are you sure you want to delete this record?');

// ---------------- introduction ----------------
export function Introduction({ introduction, onSave }: { introduction?: string; onSave: (intro: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(introduction ?? '');
  if (!editing) {
    return (
      <Stack>
        <Group justify="flex-end">
          <ActionIcon variant="default" onClick={() => setEditing(true)} aria-label="edit introduction">
            <Icon icon="edit" />
          </ActionIcon>
        </Group>
        {/* the introduction is html written by the admin */}
        <Text component="div" dangerouslySetInnerHTML={{ __html: introduction ?? '' }} />
      </Stack>
    );
  }
  return (
    <Stack>
      <Textarea
        autosize
        minRows={6}
        placeholder="intro here"
        autoFocus
        value={value}
        onChange={(e) => setValue(e.currentTarget.value)}
      />
      <Group justify="flex-end">
        <Button
          variant="default"
          onClick={() => {
            setValue(introduction ?? '');
            setEditing(false);
          }}
        >
          Cancel
        </Button>
        <Button
          disabled={value.trim().length < 5}
          onClick={() => {
            onSave(value);
            setEditing(false);
          }}
        >
          Submit
        </Button>
      </Group>
    </Stack>
  );
}

// ---------------- person ----------------
export function PersonForm({ person, onSubmit }: { person: Person; onSubmit: (p: Person) => void }) {
  const form = useForm({
    initialValues: {
      lastname: person.lastname ?? '',
      firstname: person.firstname ?? '',
      title: person.title ?? '',
      address: person.address ?? '',
      phoneNumber: person.phoneNumber ?? '',
      emailAddress: person.emailAddress ?? '',
      birthdate: toInputDate(person.birthdate ?? new Date()),
      website: person.website ?? '',
      githubUrl: person.githubUrl ?? '',
      linkedinUrl: person.linkedinUrl ?? '',
    },
    validate: {
      lastname: required(),
      firstname: required(),
      title: required(),
      address: required(),
      phoneNumber: required(),
      emailAddress: emailValidator,
      birthdate: required(),
      githubUrl: required(),
      linkedinUrl: required(),
    },
  });
  return (
    <form onSubmit={form.onSubmit((v) => onSubmit({ ...v, birthdate: fromInput(v.birthdate) }))}>
      <Stack gap="sm">
        <TextInput label="Last name" data-autofocus {...form.getInputProps('lastname')} />
        <TextInput label="First name" {...form.getInputProps('firstname')} />
        <TextInput label="Title" {...form.getInputProps('title')} />
        <TextInput label="Address" {...form.getInputProps('address')} />
        <TextInput label="Phone number" {...form.getInputProps('phoneNumber')} />
        <TextInput label="Email" type="email" {...form.getInputProps('emailAddress')} />
        <TextInput label="Birthdate" type="date" {...form.getInputProps('birthdate')} />
        <TextInput label="Website" type="url" {...form.getInputProps('website')} />
        <TextInput label="Github" type="url" {...form.getInputProps('githubUrl')} />
        <TextInput label="LinkedIn" type="url" {...form.getInputProps('linkedinUrl')} />
        <Group justify="flex-end">
          <Button type="submit" disabled={!form.isValid()}>
            Submit
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

export function PersonSection({ person, onSave }: { person: Person; onSave: (p: Person) => void }) {
  const rows: [string | [string, string], unknown][] = [
    ['id-card', `${person.lastname ?? ''} ${person.firstname ?? ''}`],
    ['dollar-sign', person.title],
    ['address-book', person.address],
    ['phone', person.phoneNumber],
    ['mail-bulk', person.emailAddress],
    ['birthday-cake', fmtDate(person.birthdate)],
    [['fab', 'linkedin'], person.linkedinUrl],
    [['fab', 'github'], person.githubUrl],
    ['book-open', person.website],
  ];
  return (
    <Paper withBorder p="md">
      <SectionHeader
        title="Personal Info"
        onEdit={() =>
          openModal({
            title: 'Update person',
            size: 'lg',
            render: (close) => (
              <PersonForm
                person={person}
                onSubmit={(p) => {
                  close();
                  onSave(p);
                }}
              />
            ),
          })
        }
      />
      <Stack gap={4}>
        {rows.map(([icon, value], i) => (
          <Group key={i} gap="xs">
            <Icon icon={icon} />
            <Text>{String(value ?? '')}</Text>
          </Group>
        ))}
      </Stack>
    </Paper>
  );
}

// ---------------- personal projects ----------------
export function ProjectForm({
  project,
  onSubmit,
}: {
  project: PersonalProject;
  onSubmit: (p: PersonalProject) => void;
}) {
  const form = useForm({
    initialValues: { name: project.name ?? '', url: project.url ?? '', description: project.description ?? '' },
    validate: { name: required(), url: required() },
  });
  return (
    <form onSubmit={form.onSubmit(onSubmit)}>
      <Stack gap="sm">
        <TextInput label="Name" data-autofocus {...form.getInputProps('name')} />
        <TextInput label="Url" type="url" {...form.getInputProps('url')} />
        <Textarea label="Description" autosize {...form.getInputProps('description')} />
        <Group justify="flex-end">
          <Button type="submit" disabled={!form.isValid()}>
            Submit
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

export function ProjectsSection({
  projects,
  onSave,
}: {
  projects: PersonalProject[];
  onSave: (p: PersonalProject[]) => void;
}) {
  const edit = (project: PersonalProject, index?: number) =>
    openModal({
      title: project.name || 'New Project',
      size: 'lg',
      render: (close) => (
        <ProjectForm
          project={project}
          onSubmit={(p) => {
            close();
            onSave(index === undefined ? [...projects, p] : projects.map((x, i) => (i === index ? p : x)));
          }}
        />
      ),
    });
  return (
    <Paper withBorder p="md">
      <SectionHeader title="Projects" onAdd={() => edit({ name: null, url: null, description: null })} />
      <Stack>
        {projects.map((p, i) => (
          <Paper key={`${p.name}-${i}`} bg="gray.0" p="sm">
            <Group justify="space-between">
              <Text fw={700}>{p.name}</Text>
              <ItemActions
                onEdit={() => edit(p, i)}
                onDelete={async () => (await askDelete()) && onSave(projects.filter((_, j) => j !== i))}
              />
            </Group>
            {p.url && (
              <Anchor href={p.url} target="_blank" size="sm">
                {p.url}
              </Anchor>
            )}
            {p.description && (
              <Text size="sm" className="pre-wrap">
                {p.description}
              </Text>
            )}
          </Paper>
        ))}
      </Stack>
    </Paper>
  );
}

// ---------------- experiences ----------------
export function ExperienceForm({
  experience,
  onSubmit,
}: {
  experience: Experience;
  onSubmit: (e: Experience) => void;
}) {
  const form = useForm({
    initialValues: {
      title: experience.title ?? '',
      company: experience.company ?? '',
      from: toInputDate(experience.from ?? new Date()),
      to: toInputDate(experience.to),
      current: !!experience.current,
      description: experience.description ?? [],
    },
    validate: { title: required(), company: required(), from: required() },
  });
  const v = form.values;
  return (
    <form
      onSubmit={form.onSubmit((values) =>
        onSubmit({
          uuid: experience.uuid,
          title: values.title,
          company: values.company,
          current: values.current,
          from: fromInput(values.from),
          to: values.current ? null : fromInput(values.to),
          description: values.description.filter((d) => d?.trim()),
        }),
      )}
    >
      <Stack gap="sm">
        <TextInput label="Title" {...form.getInputProps('title')} />
        <TextInput label="Company" {...form.getInputProps('company')} />
        <TextInput label="From" type="date" {...form.getInputProps('from')} />
        {!v.current && <TextInput label="To" type="date" {...form.getInputProps('to')} />}
        <Checkbox label="Current" {...form.getInputProps('current', { type: 'checkbox' })} />
        <Group justify="space-between">
          <Text size="sm" fw={500}>
            Descriptions
          </Text>
          <ActionIcon
            variant="default"
            onClick={() => form.insertListItem('description', '')}
            aria-label="add description"
          >
            <Icon icon="plus" />
          </ActionIcon>
        </Group>
        {v.description.map((_, i) => (
          <Group key={i} wrap="nowrap" gap={4}>
            <TextInput style={{ flex: 1 }} {...form.getInputProps(`description.${i}`)} />
            <ActionIcon
              variant="subtle"
              color="red"
              onClick={() => form.removeListItem('description', i)}
              aria-label="delete description"
            >
              <Icon icon="trash" />
            </ActionIcon>
            <ActionIcon
              variant="subtle"
              disabled={i === 0}
              onClick={() => form.reorderListItem('description', { from: i, to: i - 1 })}
              aria-label="move up"
            >
              <Icon icon="arrow-up" />
            </ActionIcon>
            <ActionIcon
              variant="subtle"
              disabled={i === v.description.length - 1}
              onClick={() => form.reorderListItem('description', { from: i, to: i + 1 })}
              aria-label="move down"
            >
              <Icon icon="arrow-down" />
            </ActionIcon>
          </Group>
        ))}
        <Group justify="flex-end">
          <Button type="submit" disabled={!form.isValid()}>
            Submit
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

export function filterExperiences(list: Experience[], search: string): Experience[] {
  if (search.length < 2) return list;
  const s = search.toUpperCase();
  return list.filter(
    (x) =>
      x.title?.toUpperCase().includes(s) ||
      x.company?.toUpperCase().includes(s) ||
      x.description?.some((d) => d.toUpperCase().includes(s)),
  );
}

export function ExperiencesSection({
  experiences,
  onSave,
}: {
  experiences: Experience[];
  onSave: (e: Experience[]) => void;
}) {
  const [search, setSearch] = useState('');
  const edit = (exp: Experience) =>
    openModal({
      title: exp.title || 'New Experience',
      size: 'xl',
      render: (close) => (
        <ExperienceForm
          experience={exp}
          onSubmit={(e) => {
            close();
            onSave([...experiences.filter((x) => x.uuid !== exp.uuid), e]);
          }}
        />
      ),
    });
  const filtered = filterExperiences(experiences, search);
  return (
    <Paper withBorder p="md">
      <SectionHeader
        title={`Experiences (${experiences.length})`}
        onAdd={() =>
          edit({
            current: false,
            company: '',
            title: '',
            from: null,
            to: null,
            description: [],
            uuid: crypto.randomUUID(),
          })
        }
      />
      <TextInput placeholder="search..." mb="sm" value={search} onChange={(e) => setSearch(e.currentTarget.value)} />
      <Stack>
        {filtered.map((exp) => (
          <Paper key={exp.uuid} bg="gray.0" p="sm">
            <Group justify="space-between">
              <Text
                fw={700}
                c={
                  search.length > 2 && exp.company?.toUpperCase().includes(search.toUpperCase())
                    ? 'artcoded'
                    : undefined
                }
              >
                {exp.title} @ {exp.company}
              </Text>
              <ItemActions
                onEdit={() => edit(exp)}
                onDelete={async () => (await askDelete()) && onSave(experiences.filter((x) => x.uuid !== exp.uuid))}
              />
            </Group>
            <Text size="sm" c="dimmed">
              {period(exp.from, exp.to, exp.current)}
            </Text>
            <Stack gap={0} mt={4}>
              {exp.description?.map((d, i) => (
                <Text key={i} size="sm">
                  {d}
                </Text>
              ))}
            </Stack>
          </Paper>
        ))}
      </Stack>
    </Paper>
  );
}

// ---------------- skills ----------------
export function SkillForm({ skill, onSubmit }: { skill: Skill; onSubmit: (s: Skill) => void }) {
  const form = useForm({
    initialValues: {
      name: skill.name ?? '',
      priority: skill.priority ?? 0,
      tags: skill.tags ?? [],
      softSkill: !!skill.softSkill,
    },
    validate: { name: required(), priority: (v) => (String(v) === '' ? 'Required' : null) },
  });
  return (
    <form onSubmit={form.onSubmit((v) => onSubmit({ ...v, priority: Number(v.priority), hardSkill: !v.softSkill }))}>
      <Stack gap="sm">
        <TextInput label="Name" data-autofocus {...form.getInputProps('name')} />
        <NumberInput label="Priority" {...form.getInputProps('priority')} />
        <TagsInput label="Tags" splitChars={[',']} {...form.getInputProps('tags')} />
        <Checkbox label="Soft Skill" {...form.getInputProps('softSkill', { type: 'checkbox' })} />
        <Group justify="flex-end">
          <Button type="submit" disabled={!form.isValid()}>
            Submit
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

export function filterSkills(list: Skill[], search: string): Skill[] {
  if (search.length < 2) return list;
  const s = search.toUpperCase();
  return list.filter((sk) => sk.name.toUpperCase().includes(s) || sk.tags?.some((t) => t.toUpperCase().includes(s)));
}

export function SkillsSection({ skills, onSave }: { skills: Skill[]; onSave: (s: Skill[]) => void }) {
  const [search, setSearch] = useState('');
  const edit = (skill: Skill) =>
    openModal({
      title: skill.name || 'New Skill',
      size: 'xl',
      render: (close) => (
        <SkillForm
          skill={skill}
          onSubmit={(s) => {
            close();
            onSave([...skills.filter((x) => x.name !== skill.name), s]);
          }}
        />
      ),
    });
  return (
    <Paper withBorder p="md">
      <SectionHeader
        title="Skills"
        onAdd={() => edit({ priority: 0, name: '', hardSkill: true, softSkill: false, tags: [] })}
      />
      <TextInput placeholder="search..." mb="sm" value={search} onChange={(e) => setSearch(e.currentTarget.value)} />
      <Stack>
        {filterSkills(skills, search).map((skill) => (
          <Paper key={skill.name} bg="gray.0" p="sm">
            <Group justify="space-between">
              <Text fw={700}>{skill.name}</Text>
              <ItemActions
                onEdit={() => edit(skill)}
                onDelete={async () => (await askDelete()) && onSave(skills.filter((x) => x.name !== skill.name))}
              />
            </Group>
            <Group gap={4}>
              {skill.tags?.map((t) => (
                <Badge key={t} variant="light">
                  {t}
                </Badge>
              ))}
            </Group>
          </Paper>
        ))}
      </Stack>
    </Paper>
  );
}

// ---------------- education ----------------
export function EducationForm({
  history,
  onSubmit,
}: {
  history: ScholarHistory;
  onSubmit: (h: ScholarHistory) => void;
}) {
  const form = useForm({
    initialValues: {
      title: history.title ?? '',
      school: history.school ?? '',
      from: toInputDate(history.from ?? new Date()),
      to: toInputDate(history.to),
      current: !!history.current,
    },
    validate: { title: required(), school: required(), from: required() },
  });
  return (
    <form
      onSubmit={form.onSubmit((v) =>
        onSubmit({
          title: v.title,
          school: v.school,
          current: v.current,
          from: fromInput(v.from),
          to: v.current ? null : fromInput(v.to),
        }),
      )}
    >
      <Stack gap="sm">
        <TextInput label="Title" data-autofocus {...form.getInputProps('title')} />
        <TextInput label="School" {...form.getInputProps('school')} />
        <TextInput label="From" type="date" {...form.getInputProps('from')} />
        {!form.values.current && <TextInput label="To" type="date" {...form.getInputProps('to')} />}
        <Checkbox label="Current" {...form.getInputProps('current', { type: 'checkbox' })} />
        <Group justify="flex-end">
          <Button type="submit" disabled={!form.isValid()}>
            Submit
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

export function EducationSection({
  histories,
  onSave,
}: {
  histories: ScholarHistory[];
  onSave: (h: ScholarHistory[]) => void;
}) {
  const edit = (history: ScholarHistory, index?: number) =>
    openModal({
      title: history.title || 'New Education',
      size: 'xl',
      render: (close) => (
        <EducationForm
          history={history}
          onSubmit={(h) => {
            close();
            onSave(index === undefined ? [...histories, h] : histories.map((x, i) => (i === index ? h : x)));
          }}
        />
      ),
    });
  return (
    <Paper withBorder p="md">
      <SectionHeader
        title="Educations"
        onAdd={() => edit({ current: false, school: '', title: '', from: null, to: null })}
      />
      <Stack>
        {histories.map((h, i) => (
          <Paper key={`${h.title}-${i}`} bg="gray.0" p="sm">
            <Group justify="space-between">
              <Text fw={700}>
                {h.title} @ {h.school}
              </Text>
              <ItemActions
                onEdit={() => edit(h, i)}
                onDelete={async () => (await askDelete()) && onSave(histories.filter((_, j) => j !== i))}
              />
            </Group>
            <Text size="sm" c="dimmed">
              {period(h.from, h.to, h.current)}
            </Text>
          </Paper>
        ))}
      </Stack>
    </Paper>
  );
}

// ---------------- hobbies ----------------
export function HobbiesForm({ hobbies, onSubmit }: { hobbies: Hobby[]; onSubmit: (h: Hobby[]) => void }) {
  const form = useForm({ initialValues: { hobbies: hobbies.map((h) => h.title) } });
  return (
    <form onSubmit={form.onSubmit((v) => onSubmit(v.hobbies.map((title) => ({ title }))))}>
      <Stack gap="sm">
        <Group justify="flex-end">
          <ActionIcon variant="default" onClick={() => form.insertListItem('hobbies', '')} aria-label="add hobby">
            <Icon icon="plus" />
          </ActionIcon>
        </Group>
        {form.values.hobbies.map((_, i) => (
          <Group key={i} wrap="nowrap">
            <TextInput style={{ flex: 1 }} autoFocus={i === 0} {...form.getInputProps(`hobbies.${i}`)} />
            <ActionIcon
              variant="subtle"
              color="red"
              onClick={() => form.removeListItem('hobbies', i)}
              aria-label="delete hobby"
            >
              <Icon icon="trash" />
            </ActionIcon>
          </Group>
        ))}
        <Group justify="flex-end">
          <Button type="submit">Submit</Button>
        </Group>
      </Stack>
    </form>
  );
}

export function HobbiesSection({ hobbies, onSave }: { hobbies: Hobby[]; onSave: (h: Hobby[]) => void }) {
  return (
    <Paper withBorder p="md">
      <SectionHeader
        title="Hobbies"
        onEdit={() =>
          openModal({
            title: 'Hobbies',
            size: 'xl',
            render: (close) => (
              <HobbiesForm
                hobbies={hobbies}
                onSubmit={(h) => {
                  close();
                  onSave(h);
                }}
              />
            ),
          })
        }
      />
      <Stack gap={4}>
        {hobbies.map((h, i) => (
          <Text key={i}>• {h.title}</Text>
        ))}
      </Stack>
    </Paper>
  );
}
