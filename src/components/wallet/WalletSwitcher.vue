<script setup lang="ts">
import { computed, ref } from "vue";
import { usePreferredDark } from "@vueuse/core";
import {
  CheckIcon,
  ChevronsUpDownIcon,
  EyeIcon,
  EyeOffIcon,
  InfoIcon,
  LoaderCircleIcon,
  MoonIcon,
  PlusCircleIcon,
  SettingsIcon,
  SunIcon
} from "lucide-vue-next";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { useAppStore } from "@/stores/appStore";
import { useWalletStore } from "@/stores/walletStore";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { WalletItem } from "@/components/wallet";
import { IDbWallet } from "@/types/database";

const wallet = useWalletStore();
const app = useAppStore();
const router = useRouter();
const { t } = useI18n();

const current = computed(() => app.wallets.find((w) => w.id === wallet.id));

const isOpen = ref(false);
const searchTerm = ref("");
const loadingId = ref<number | false>();

const normalizedSearchTerm = computed(() => normalize(searchTerm.value));

function normalize(value?: string) {
  return value?.trim().toLocaleLowerCase() ?? "";
}

function goToAndClose(name: string) {
  goTo(name);
  closePopover();
}

function goTo(name: string) {
  if (router.currentRoute.value.name !== name) router.push({ name });
}

async function loadWallet(walletId: number) {
  setLoading(walletId);

  await wallet.load(walletId);
  goTo("assets");

  setLoading(false);
  closePopover();
}

function setLoading(id: number | false) {
  loadingId.value = id;
}

function closePopover() {
  isOpen.value = false;
}

function toggleValuesVisibility() {
  app.settings.hideBalances = !app.settings.hideBalances;
}

const prefersDark = usePreferredDark();
const isDark = computed(() =>
  app.settings.colorMode === "auto" ? prefersDark.value : app.settings.colorMode === "dark"
);

function toggleColorMode() {
  app.settings.colorMode = isDark.value ? "light" : "dark";
}

</script>
<template>
  <Popover v-model:open="isOpen">
    <PopoverTrigger as-child>
      <Button
        variant="ghost"
        role="combobox"
        :aria-expanded="isOpen"
        class="h-full w-[210px] justify-between bg-transparent"
      >
        <WalletItem v-if="current" :wallet="current" />
        <ChevronsUpDownIcon class="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
    </PopoverTrigger>
    <PopoverContent class="w-[210px] p-0">
      <Command
        v-model:search-term="searchTerm"
        class="max-h-[500px]"
        reset-search-term-on-blur
        :filter-function="
          (wallets: IDbWallet[]) =>
            wallets.filter((w) => normalize(w.name).includes(normalizedSearchTerm))
        "
      >
        <CommandInput :placeholder="t('common.search')" />
        <CommandEmpty>{{ t("header.menu.noWalletsFound") }}</CommandEmpty>
        <CommandList>
          <CommandGroup>
            <CommandItem
              v-for="w in app.wallets"
              :key="w.id"
              class="gap-2"
              :value="w"
              @select="loadWallet(w.id)"
            >
              <WalletItem v-if="current" :wallet="w" concise />

              <div class="h-4 w-4 transition-all duration-700">
                <LoaderCircleIcon v-if="loadingId === w.id" class="h-full w-full animate-spin" />
                <CheckIcon v-else-if="current?.id === w.id" class="h-full w-full" />
              </div>
            </CommandItem>
          </CommandGroup>
        </CommandList>

        <CommandSeparator />

        <div class="flex flex-row items-center justify-center gap-2 pt-2">
          <Button
            class="cursor-default"
            variant="ghost"
            size="icon"
            @click="toggleValuesVisibility"
          >
            <EyeIcon v-if="app.settings.hideBalances" />
            <EyeOffIcon v-else />
          </Button>
          <Button class="cursor-default" variant="ghost" size="icon" @click="toggleColorMode">
            <SunIcon v-if="isDark" />
            <MoonIcon v-else />
          </Button>
        </div>

        <CommandList>
          <CommandGroup>
            <CommandItem
              class="gap-2"
              value="add-wallet"
              @select.prevent="goToAndClose('add-wallet')"
              v-once
            >
              <PlusCircleIcon class="h-5 w-5 shrink-0" />
              {{ t("header.menu.newWallet") }}
            </CommandItem>

            <CommandItem
              class="gap-2"
              value="settings"
              @select.prevent="goToAndClose('wallet-settings')"
              v-once
            >
              <SettingsIcon class="h-5 w-5 shrink-0" />
              {{ t("header.menu.settings") }}
            </CommandItem>

            <CommandItem
              class="gap-2"
              value="about"
              @select.prevent="goToAndClose('about-nautilus')"
              v-once
            >
              <InfoIcon class="h-5 w-5 shrink-0" />
              {{ t("header.menu.about") }}
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>
</template>
