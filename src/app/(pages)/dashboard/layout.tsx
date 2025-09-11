"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
// import { useSession, signOut } from "next-auth/react"; // Placeholder for auth
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ChevronsUpDown, LayoutGrid, BookUser, CreditCard, Settings, LifeBuoy, LogOut,
  HelpCircle, MessageSquare, PanelLeftClose, PanelLeftOpen, Sun, Moon, FolderKanban,
  Loader2, Plus, Trash2, Download, MoreHorizontal, Pencil, Copy,
  FileText, // --- MODIFICATION: Import the report icon ---
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DashboardProvider, useDashboard, Session } from "@/components/DashboardContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import Logo from "@/components/Logo";

// A small component to render the layout content, so it can access the context
function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const { setTheme } = useTheme();
  const [isCollapsed, setIsCollapsed] = useState(true);
  
  // --- MODIFICATION START: Get necessary data and add loading state ---
  const { sessions, activeSessionId, nodes, edges, newSession, deleteSession, renameSession, forkSession, loadSession } = useDashboard();
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  // --- MODIFICATION END ---


  const handleExport = () => {
    if (Object.keys(sessions).length === 0) {
        alert("No sessions to export.");
        return;
    }
    const dataStr = JSON.stringify(sessions, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'cassandra-sessions.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // --- MODIFICATION START: Add report generation handler ---
  const handleGenerateReport = async () => {
    if (!activeSessionId || nodes.length === 0) {
      alert("There's no canvas data to generate a report from.");
      return;
    }
    setIsGeneratingReport(true);
    try {
      const response = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes, edges }),
      });

      if (!response.ok) {
        throw new Error(`Failed to generate report: ${response.statusText}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const sessionName = sessions[activeSessionId]?.name.replace(/\s+/g, '_') || 'session';
      link.download = `Cassandra_Report_${sessionName}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

    } catch (error) {
      console.error("Report generation failed:", error);
      alert("Sorry, there was an error generating your report. Please try again.");
    } finally {
      setIsGeneratingReport(false);
    }
  };
  // --- MODIFICATION END ---


  const handleRenameSubmit = (id: string, newName: string) => {
    if (newName && newName.trim() !== "") {
      renameSession(id, newName.trim());
    }
    setRenamingId(null);
  };


  const sessionGroups = useMemo(() => {
    const groups: { [key: string]: Session[] } = { Today: [], Yesterday: [], "Previous 7 Days": [], "Older": [] };
    const today = new Date(); const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1); const sevenDaysAgo = new Date(today); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    Object.values(sessions)
      .filter(Boolean)
      .sort((a, b) => b.createdAt - a.createdAt)
      .forEach(session => {
        const sessionDate = new Date(session.createdAt);
        if (sessionDate.toDateString() === today.toDateString()) groups.Today.push(session);
        else if (sessionDate.toDateString() === yesterday.toDateString()) groups.Yesterday.push(session);
        else if (sessionDate > sevenDaysAgo) groups["Previous 7 Days"].push(session);
        else groups.Older.push(session);
    });
    return groups;
  }, [sessions]);


  return (
    <TooltipProvider>
      <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">
        <aside className={cn(
          "hidden md:flex flex-col border-r bg-muted/40 transition-all duration-300 ease-in-out shrink-0",
          isCollapsed ? "w-[56px]" : "w-[240px]"
        )}>
           <div className={cn("flex h-14 items-center border-b px-4")}>
            <Logo hideText={isCollapsed} />
           </div>
           <div className="p-2">
             <Button onClick={newSession} className="w-full" variant="outline" size={isCollapsed ? "icon" : "default"}>
                <Plus className="h-4 w-4" />
                <span className={cn("ml-2", isCollapsed && "hidden")}>New Session</span>
             </Button>
           </div>
           <ScrollArea className="flex-1 px-2">
             {Object.entries(sessionGroups).map(([groupName, groupSessions]) => ( groupSessions.length > 0 && (
                <div key={groupName} className="py-2">
                  <h3 className={cn("text-xs font-semibold text-muted-foreground px-2 mb-2", isCollapsed && "text-center")}>{isCollapsed ? groupName.substring(0,1) : groupName}</h3>
                  <div className="space-y-1">
                    {groupSessions.map(session => (
                      <Tooltip key={session.id} delayDuration={0}>
                        <TooltipTrigger asChild>
                          <div
                            onClick={() => { if (renamingId !== session.id) loadSession(session.id); }}
                            className={cn(
                              "group flex items-center gap-3 rounded-md px-3 py-2 text-sm cursor-pointer transition-all hover:bg-accent hover:text-accent-foreground min-w-0",
                              activeSessionId === session.id ? "bg-accent text-accent-foreground" : "text-muted-foreground",
                              isCollapsed && "justify-center"
                            )}
                          >
                            <MessageSquare className="h-4 w-4 shrink-0" />
                            <div className={cn("flex-1 min-w-0 flex items-center", isCollapsed && "hidden")}>
                              {renamingId === session.id ? (
                                 <input
                                   type="text"
                                   defaultValue={session.name}
                                   className="flex-1 min-w-0 bg-transparent border border-primary rounded-md px-1 py-0 text-sm focus:outline-none"
                                   autoFocus
                                   onClick={(e) => e.stopPropagation()}
                                   onBlur={(e) => handleRenameSubmit(session.id, e.target.value)}
                                   onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                                 />
                               ) : (
                                 <span className="flex-1 truncate min-w-0">
                                   {session.name}
                                 </span>
                               )}
                              <div className="ml-2 opacity-0 group-hover:opacity-100 shrink-0">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={e => e.stopPropagation()}>
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent onClick={e => e.stopPropagation()} align="end" className="w-40">
                                    <DropdownMenuItem onClick={() => setRenamingId(session.id)}>
                                      <Pencil className="mr-2 h-4 w-4" />
                                      <span>Rename</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => forkSession(session.id)}>
                                      <Copy className="mr-2 h-4 w-4" />
                                      <span>Duplicate</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => deleteSession(session.id)}>
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      <span>Delete</span>
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>
                          </div>
                        </TooltipTrigger>
                        {isCollapsed && (<TooltipContent side="right">{session.name}</TooltipContent>)}
                      </Tooltip>
                    ))}
                  </div>
                </div>
              )))}
           </ScrollArea>
           <div className="mt-auto border-t p-2">
             <Tooltip delayDuration={0}>
               <TooltipTrigger asChild>
                 <Button onClick={() => setIsCollapsed(!isCollapsed)} variant="ghost" className="w-full justify-start gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-all hover:bg-accent hover:text-accent-foreground">
                   {isCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
                   <span className={cn("truncate", isCollapsed && "hidden")}>Collapse</span>
                 </Button>
               </TooltipTrigger>
               {isCollapsed && (<TooltipContent side="right">Expand</TooltipContent>)}
             </Tooltip>
           </div>
        </aside>

        <div className="flex flex-1 flex-col">
          <header className="flex h-14 items-center gap-4 border-b bg-background px-6 shrink-0">
             <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="flex-1 justify-between max-w-xs">
                    <div className="flex items-center gap-2">
                      <div className="p-1 rounded-md bg-zinc-700/50">
                          <FolderKanban className="size-4 text-zinc-300"/>
                      </div>
                      <span className="font-semibold">My Startup Analysis</span>
                    </div>
                    <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)]">
                  <DropdownMenuLabel>Projects (Coming Soon)</DropdownMenuLabel>
                  <DropdownMenuItem disabled>My Startup Analysis</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

            <div className="ml-auto flex items-center gap-2">
            <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <Button asChild variant="ghost" size="icon" className="h-8 w-8">
                      <Link href="/browse">
                        <LayoutGrid className="h-4 w-4" />
                        <span className="sr-only">Browse Corpus</span>
                      </Link>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Browse Corpus</TooltipContent>
              </Tooltip>
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" /><Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" /><span className="sr-only">Toggle theme</span></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end"><DropdownMenuItem onClick={() => setTheme("light")}>Light</DropdownMenuItem><DropdownMenuItem onClick={() => setTheme("dark")}>Dark</DropdownMenuItem><DropdownMenuItem onClick={() => setTheme("system")}>System</DropdownMenuItem></DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full h-8 w-8">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={`https://api.dicebear.com/8.x/lorelei/svg?seed=cassandra-user`} alt={'User'} />
                      <AvatarFallback>U</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                 <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Account</DropdownMenuLabel>
                    {/* --- MODIFICATION START: Add the new report button --- */}
                    <DropdownMenuItem onClick={handleGenerateReport} disabled={isGeneratingReport}>
                      {isGeneratingReport ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <FileText className="mr-2 h-4 w-4" />
                      )}
                      <span>{isGeneratingReport ? 'Generating...' : 'Generate Report'}</span>
                    </DropdownMenuItem>
                    {/* --- MODIFICATION END --- */}
                    <DropdownMenuItem onClick={handleExport}>
                      <Download className="mr-2 h-4 w-4" />
                      <span>Export Sessions</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem disabled><Settings className="mr-2 h-4 w-4" /><span>Settings</span></DropdownMenuItem>
                    <DropdownMenuItem disabled><LifeBuoy className="mr-2 h-4 w-4" /><span>Support</span></DropdownMenuItem>
                  </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          <main className="flex-1 bg-muted/20 overflow-hidden relative">
            {children}
          </main>
        </div>
      </div>
    </TooltipProvider>
  )
}

// The main layout component wraps its children in the provider
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardProvider>
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </DashboardProvider>
  );
}