import { useEffect, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  Center,
  Checkbox,
  Group,
  Loader,
  NumberInput,
  Paper,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core';
import { Dropzone } from '@mantine/dropzone';
import { useForm } from '@mantine/form';
import { useQueryClient } from '@tanstack/react-query';
import { Icon } from '@/components/Icon';
import { AuthImage } from '@/components/common';
import { personalInfoApi } from '@/api/misc';
import { errorMessage } from '@/api/http';
import { PERSONAL_INFO_KEY, ME_KEY, useIsAdmin, usePersonalInfo } from '@/auth/session';
import { toast } from '@/lib/ui';
import { countryCodeValidator, emailValidator, required } from '@/lib/validators';
import type { Accountant, PersonalInfo } from '@/types';

type ImageKey = 'logo' | 'signature' | 'initial';

export function PersonalInfoForm() {
  const { data: info } = usePersonalInfo();
  if (!info) return <Loader />;
  return <PersonalInfoFormContent info={info} />;
}

function ImageField({
  label,
  uploadId,
  file,
  onFile,
  disabled,
}: {
  label: string;
  uploadId?: string;
  file?: File;
  onFile: (f: File) => void;
  disabled: boolean;
}) {
  const [preview, setPreview] = useState<string>();
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const hasImage = !!preview || !!uploadId;
  return (
    <Stack gap={6}>
      <Group justify="space-between">
        <Text size="sm" fw={500}>
          {label}
        </Text>
        {file && (
          <Badge size="xs" variant="light">
            Not saved
          </Badge>
        )}
      </Group>
      <Dropzone
        onDrop={(f) => f[0] && onFile(f[0])}
        accept={['image/*']}
        multiple={false}
        disabled={disabled}
        p={0}
        radius="md"
        className="image-field"
      >
        <Center h={140} p="sm" style={{ pointerEvents: 'none' }}>
          {preview ? (
            <img src={preview} alt={label} />
          ) : uploadId ? (
            <AuthImage id={uploadId} alt={label} />
          ) : (
            <Stack align="center" gap={4}>
              <Icon icon="image" size="lg" color="var(--mantine-color-gray-5)" />
              <Text size="xs" c="dimmed">
                Drop or click to add
              </Text>
            </Stack>
          )}
        </Center>
        {hasImage && !disabled && (
          <div className="image-field-overlay">
            <Icon icon="upload" />
            <Text size="xs" fw={500}>
              Replace
            </Text>
          </div>
        )}
      </Dropzone>
    </Stack>
  );
}

function PersonalInfoFormContent({ info }: { info: PersonalInfo }) {
  const isAdmin = useIsAdmin();
  const client = useQueryClient();
  const [images, setImages] = useState<Partial<Record<ImageKey, File>>>({});
  const form = useForm({
    initialValues: {
      ceoFullName: info.ceoFullName ?? '',
      vatNumber: info.vatNumber ?? '',
      organizationName: info.organizationName ?? '',
      note: info.note ?? '',
      demoMode: !!info.demoMode,
      organizationAddress: info.organizationAddress ?? '',
      organizationCity: info.organizationCity ?? '',
      organizationPostCode: info.organizationPostCode ?? '',
      countryCode: info.countryCode ?? '',
      organizationEmailAddress: info.organizationEmailAddress ?? '',
      organizationPhoneNumber: info.organizationPhoneNumber ?? '',
      organizationBankAccount: info.organizationBankAccount ?? '',
      organizationBankBIC: info.organizationBankBIC ?? '',
      financeCharge: info.financeCharge ?? 0,
      maxDaysToPay: info.maxDaysToPay ?? 30,
      accountants: (info.accountants ?? []).map((a) => ({
        ...a,
        phoneNumber: a.phoneNumber ?? '',
        expenseReceiveEmailHook: a.expenseReceiveEmailHook ?? '',
      })),
    },
    validate: {
      ceoFullName: required(),
      vatNumber: required(),
      organizationName: required(),
      note: required(),
      organizationAddress: required(),
      organizationCity: required(),
      organizationPostCode: required(),
      countryCode: countryCodeValidator,
      organizationEmailAddress: required(),
      organizationPhoneNumber: required(),
      organizationBankAccount: required(),
      organizationBankBIC: required(),
      financeCharge: (v) => (v === null || v === undefined || Number(v) < 0 ? 'Min 0' : null),
      maxDaysToPay: (v) => (!v || Number(v) < 1 ? 'Min 1' : null),
      accountants: {
        firstName: required(),
        lastName: required(),
        phoneNumber: required(),
        email: emailValidator,
        expenseReceiveEmailHook: (v) => (!v ? null : emailValidator(v)),
      },
    },
  });

  const submit = form.onSubmit(async (v) => {
    if (!isAdmin) return;
    const fd = new FormData();
    if (images.logo) fd.append('logo', images.logo);
    if (images.signature) fd.append('signature', images.signature);
    if (images.initial) fd.append('initial', images.initial);
    const { accountants, ...rest } = v;
    Object.entries(rest).forEach(([key, value]) => fd.append(key, String(value ?? '')));
    fd.append('accountants', JSON.stringify(accountants as Accountant[]));
    try {
      const saved = await personalInfoApi.save(fd);
      toast.success('Personal Information updated');
      client.invalidateQueries({ queryKey: PERSONAL_INFO_KEY });
      client.invalidateQueries({ queryKey: ME_KEY });
      if (!!saved.demoMode !== !!info.demoMode) window.location.reload();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  });

  const field = (key: keyof typeof form.values, label: string, placeholder?: string) => (
    <TextInput label={label} placeholder={placeholder} disabled={!isAdmin} {...form.getInputProps(key)} />
  );

  return (
    <form onSubmit={submit}>
      <Tabs defaultValue="metadata">
        <Tabs.List>
          <Tabs.Tab value="metadata">Metadata</Tabs.Tab>
          <Tabs.Tab value="contact">Contact/Bank</Tabs.Tab>
          <Tabs.Tab value="accountants">Accountants</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="metadata" pt="sm">
          <Stack gap="sm">
            {field('ceoFullName', 'Full Name', 'CEO FullName')}
            {field('vatNumber', 'VAT', 'VAT Number')}
            {field('organizationName', 'Organization', "Organization's Name")}
            <SimpleGrid cols={{ base: 1, md: 3 }}>
              {(['logo', 'signature', 'initial'] as ImageKey[]).map((k) => (
                <ImageField
                  key={k}
                  label={k[0].toUpperCase() + k.slice(1)}
                  uploadId={info[`${k}UploadId` as const]}
                  file={images[k]}
                  disabled={!isAdmin}
                  onFile={(f) => setImages((i) => ({ ...i, [k]: f }))}
                />
              ))}
            </SimpleGrid>
            <Textarea label="Note" autosize minRows={2} disabled={!isAdmin} {...form.getInputProps('note')} />
            <Checkbox label="Demo mode" disabled={!isAdmin} {...form.getInputProps('demoMode', { type: 'checkbox' })} />
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="contact" pt="sm">
          <Stack gap="sm">
            {field('organizationAddress', 'Address')}
            {field('organizationCity', 'City')}
            {field('organizationPostCode', 'Post Code')}
            {field('countryCode', 'Country code', 'e.g BE')}
            {field('organizationEmailAddress', 'Email')}
            {field('organizationPhoneNumber', 'Phone Number')}
            {field('organizationBankAccount', 'Bank Account')}
            {field('organizationBankBIC', 'Bank Account BIC', 'BIC')}
            <NumberInput
              label="Finance Charge"
              placeholder="E.G 1.5"
              disabled={!isAdmin}
              {...form.getInputProps('financeCharge')}
            />
            <NumberInput label="Max Days To Pay" disabled={!isAdmin} {...form.getInputProps('maxDaysToPay')} />
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="accountants" pt="sm">
          <Stack gap="sm">
            {isAdmin && (
              <Group justify="flex-end">
                <Button
                  variant="outline"
                  leftSection={<Icon icon="plus" />}
                  onClick={() =>
                    form.insertListItem('accountants', {
                      firstName: '',
                      lastName: '',
                      email: '',
                      phoneNumber: '',
                      emailHook: false,
                      expenseReceiveEmailHook: '',
                    })
                  }
                >
                  Add
                </Button>
              </Group>
            )}
            {!form.values.accountants.length && <Text c="dimmed">No Content.</Text>}
            {form.values.accountants.map((a, i) => (
              <Paper key={i} withBorder p="sm" bg="gray.0">
                <SimpleGrid cols={{ base: 1, md: 2 }}>
                  <TextInput
                    label="First Name"
                    disabled={!isAdmin}
                    {...form.getInputProps(`accountants.${i}.firstName`)}
                  />
                  <TextInput
                    label="Last Name"
                    disabled={!isAdmin}
                    {...form.getInputProps(`accountants.${i}.lastName`)}
                  />
                  <TextInput label="Email" disabled={!isAdmin} {...form.getInputProps(`accountants.${i}.email`)} />
                  <TextInput
                    label="Phone number"
                    disabled={!isAdmin}
                    {...form.getInputProps(`accountants.${i}.phoneNumber`)}
                  />
                </SimpleGrid>
                <Checkbox
                  mt="sm"
                  label="With email hooks"
                  disabled={!isAdmin}
                  {...form.getInputProps(`accountants.${i}.emailHook`, { type: 'checkbox' })}
                />
                {a.emailHook && (
                  <TextInput
                    mt="sm"
                    label="Expense Processed Email Hook"
                    disabled={!isAdmin}
                    {...form.getInputProps(`accountants.${i}.expenseReceiveEmailHook`)}
                  />
                )}
                {isAdmin && (
                  <Group justify="flex-end">
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      onClick={() => form.removeListItem('accountants', i)}
                      aria-label="remove accountant"
                    >
                      <Icon icon="trash" />
                    </ActionIcon>
                  </Group>
                )}
              </Paper>
            ))}
          </Stack>
        </Tabs.Panel>
      </Tabs>
      {isAdmin && (
        <Group justify="flex-end" mt="md">
          <Button type="submit" disabled={!form.isValid()}>
            Submit
          </Button>
        </Group>
      )}
    </form>
  );
}
