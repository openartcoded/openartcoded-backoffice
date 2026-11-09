import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { ActionIcon, Button, Group, Loader, Menu, Tabs } from '@mantine/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Icon } from '@/components/Icon';
import { PageTitle } from '@/components/common';
import { openModal } from '@/components/modal';
import { TemplatesManager } from '@/components/TemplatesManager';
import { cvApi } from '@/api/misc';
import type { Curriculum } from '@/types';
import { EducationSection, ExperiencesSection, HobbiesSection, Introduction, PersonSection, ProjectsSection, SkillsSection } from './sections';

export function CvPage() {
  const navigate = useNavigate();
  const client = useQueryClient();
  const { data: cv } = useQuery({ queryKey: ['cv'], queryFn: cvApi.full });

  useEffect(() => {
    document.title = 'Curriculum Vitae';
  }, []);

  /** every section updates the whole curriculum */
  const update = async (patch: Partial<Curriculum>) => {
    if (!cv) return;
    await cvApi.update({ ...cv, ...patch });
    client.invalidateQueries({ queryKey: ['cv'] });
  };

  const openTemplates = () =>
    cv &&
    openModal({
      title: 'CV Templates',
      size: 'lg',
      render: () => (
        <TemplatesManager
          queryKey="cv"
          load={cvApi.listTemplates}
          add={cvApi.addTemplate}
          remove={(t) => cvApi.deleteTemplate(t.id!)}
          defaultTemplateId={cv.freemarkerTemplateId}
          setDefault={(t) => update({ freemarkerTemplateId: t.id })}
        />
      ),
    });

  if (!cv) return <Loader />;

  return (
    <>
      <PageTitle title="Curriculum">
        <Menu position="bottom-end">
          <Menu.Target>
            <Button variant="outline">Actions</Button>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item leftSection={<Icon icon="download" />} onClick={() => cvApi.downloadAsAdmin()}>
              Download
            </Menu.Item>
            <Menu.Item leftSection={<Icon icon="eye" />} onClick={() => navigate('/cv/download-requests')}>
              Requests
            </Menu.Item>
            <Menu.Item leftSection={<Icon icon="edit" />} onClick={() => navigate('/cv/editor')}>
              Import/Export
            </Menu.Item>
            <Menu.Item leftSection={<Icon icon="envelope" />} onClick={openTemplates}>
              Templates
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </PageTitle>
      <Tabs defaultValue="about">
        <Tabs.List>
          <Tabs.Tab value="about">About</Tabs.Tab>
          <Tabs.Tab value="person">Personal Info</Tabs.Tab>
          <Tabs.Tab value="projects">Projects</Tabs.Tab>
          <Tabs.Tab value="experiences">Experiences</Tabs.Tab>
          <Tabs.Tab value="skills">Skills</Tabs.Tab>
          <Tabs.Tab value="education">Education</Tabs.Tab>
          <Tabs.Tab value="hobbies">Hobbies</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="about" pt="sm">
          <Group justify="center" mb="sm">
            <ActionIcon component="a" href={cv.person?.linkedinUrl} target="_blank" variant="subtle" size="xl" aria-label="linkedin">
              <Icon icon={['fab', 'linkedin']} size="2x" />
            </ActionIcon>
            <ActionIcon component="a" href={cv.person?.githubUrl} target="_blank" variant="subtle" size="xl" aria-label="github">
              <Icon icon={['fab', 'github']} size="2x" />
            </ActionIcon>
          </Group>
          <Introduction introduction={cv.introduction} onSave={(introduction) => update({ introduction })} />
        </Tabs.Panel>
        <Tabs.Panel value="person" pt="sm">
          <PersonSection person={cv.person ?? {}} onSave={(person) => update({ person })} />
        </Tabs.Panel>
        <Tabs.Panel value="projects" pt="sm">
          <ProjectsSection projects={cv.personalProjects ?? []} onSave={(personalProjects) => update({ personalProjects })} />
        </Tabs.Panel>
        <Tabs.Panel value="experiences" pt="sm">
          <ExperiencesSection experiences={cv.experiences ?? []} onSave={(experiences) => update({ experiences })} />
        </Tabs.Panel>
        <Tabs.Panel value="skills" pt="sm">
          <SkillsSection skills={cv.skills ?? []} onSave={(skills) => update({ skills })} />
        </Tabs.Panel>
        <Tabs.Panel value="education" pt="sm">
          <EducationSection histories={cv.scholarHistories ?? []} onSave={(scholarHistories) => update({ scholarHistories })} />
        </Tabs.Panel>
        <Tabs.Panel value="hobbies" pt="sm">
          <HobbiesSection hobbies={cv.hobbies ?? []} onSave={(hobbies) => update({ hobbies })} />
        </Tabs.Panel>
      </Tabs>
    </>
  );
}
