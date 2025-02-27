"use server"
import {v4, validate} from "uuid";
import {createClient} from "@/utils/supabase/server";
import db from "@/lib/supabase/db";
import {workspaces, folders, users, collaborators, files} from "../../../migrations/schema";
import {and, eq, notExists} from "drizzle-orm";
import {Folder, Subscription, workspace, File} from "../../lib/supabase/supabase.types";
import {revalidatePath} from "next/cache";

export async function addColaborator (workspaceId : string, memberId : string) {
    try {
        await db.insert(collaborators).values({
            workspaceId,
            userId : memberId,
            createdAt : new Date().toISOString()
        })
    } catch (e) {
        console.log(e);
    }
}

export async function getCollaborators (workspaceId : string) {
    try {
        const data= await db.select({id : users.id, fullname : users.fullName, imageUrl : users.avatarUrl}).from(collaborators).innerJoin(users,eq(collaborators.userId,users.id)).where(eq(collaborators.workspaceId,workspaceId));
        return data;
    } catch (e) {
        console.log(e);
    }
}

export async function revalidateDashboard() {
    revalidatePath("/dashboard");
}

export async function getUserData(userId : string) {
    const data = await db.select().from(users).where(eq(users.id,userId));
    return {id : data[0].id, fullname : data[0].fullName, email : data[0].email, avatarUrl : data[0].avatarUrl}
}

export async function getWorkspaceTitle (workspaceId : string) {
    const data = await db.select({title : workspaces.title}).from(workspaces).where(eq(workspaces.id,workspaceId));
    return data[0].title;
}

export async function getFolderTitle (folderId : string) {
    const data = await db.select({title : folders.title}).from(folders).where(eq(folders.id,folderId));
    return data[0].title;
}

export async function getFileTitle (fileId : string) {
    const data = await db.select({title : files.title}).from(files).where(eq(files.id,fileId));
    return data[0].title;
}

export async function createWorkspace(workspaceName : string, file : any, userId : string) {
    const workspaceUUID = v4();
    const supabase = await createClient();
    let filePath = null;
    if (file) {
        const {data, error} = await supabase.storage.from("logos").upload(`workspace/${workspaceUUID}.png`,file);
        if (error) {
            return {data : null, success : false}
        }
        filePath = data?.path
    }

    try {
         await db.insert(workspaces).values({
            id: workspaceUUID,
            title: workspaceName,
            workspaceOwner: userId,
            logo: filePath,
            createdAt: new Date().toISOString(),
            data: null,
            iconId: "",
            inTrash: "",
            bannerUrl: "",
        })
    } catch (e) {
        console.log(e);
        return {data : null, success : false, type : null};
    }
}

export async function createFolder (folder : Folder) {
    try {
    const newFolder =  await db.insert(folders).values(folder).returning();
    return {data : newFolder[0], error : null}
    } catch (e) {
        console.log(e);
        return {data : null, error : "error"}
    }
}

export async function renameFolder (folderId : string, newName : string) {
    if (!folderId || !newName) return;
    await db.update(folders).set({title: newName}).where(eq(folders.id,folderId));
}

export async function getUserSubscriptionStatus (userId : string) {
    try {
        const data = await db.query.subscriptions.findFirst({
            where: (s,{eq}) => eq(s.userId, userId)
        })

        if (data) return {data : data as Subscription, error : null};
        else return {data : null, error : null}
    } catch (e) {
        console.log(e);
        return {data : null, error : "Something went wrong"};
    }
}

export async function getFolders (workspaceId : string) {
    const isValid = validate(workspaceId);
    if (!isValid)
        return {
            data: null,
            error: 'Error',
        };

    try {
        const results: Folder[] | [] = await db
            .select()
            .from(folders)
            .orderBy(folders.createdAt)
            .where(eq(folders.workspaceId, workspaceId));
        return { data: results, error: null };
    } catch (error) {
        console.log(error);
        return { data: null, error: 'Error' };
    }
}

export async function createPage (file : File) {
    await db.insert(files).values(file);
}

export async function getPages (folderId : string) {
    if (!folderId) return [];
    try {
        const res : File[] | [] = await db.select().from(files).where(eq(files.folderId,folderId));
        return res;
    } catch (e) {
        console.log(e);
        return [];
    }
}

export async function getPrivateWorkspaces(userId: string) {
    if (!userId) return [];


    const privateWorkspaces = await db
        .select({
            id: workspaces.id,
            createdAt: workspaces.createdAt,
            workspaceOwner: workspaces.workspaceOwner,
            title: workspaces.title,
            iconId: workspaces.iconId,
            data: workspaces.data,
            inTrash: workspaces.inTrash,
            logo: workspaces.logo,
            bannerUrl: workspaces.bannerUrl,
        })
        .from(workspaces)
        .where(
            and(
                notExists(
                    db
                        .select()
                        .from(collaborators)
                        .where(eq(collaborators.workspaceId, workspaces.id))
                ),
                eq(workspaces.workspaceOwner, userId)
            )
        ) as workspace[];

    return privateWorkspaces;
}

export async function getCollaborativeWorkspaces (userId : string) {
    if (!userId) return [];

    const collaboratedWorkspaces = await db
        .select({
            id: workspaces.id,
            createdAt: workspaces.createdAt,
            workspaceOwner: workspaces.workspaceOwner,
            title: workspaces.title,
            iconId: workspaces.iconId,
            data: workspaces.data,
            inTrash: workspaces.inTrash,
            logo: workspaces.logo,
            bannerUrl: workspaces.bannerUrl,
        })
        .from(users)
        .innerJoin(collaborators, eq(users.id, collaborators.userId))
        .innerJoin(workspaces, eq(collaborators.workspaceId, workspaces.id))
        .where(eq(users.id, userId)) as workspace[];

    return collaboratedWorkspaces;
}

export async function getSharedWorkspaces (userId : string) {
    if (!userId) return [];

    const sharedWorkspaces = await db
        .selectDistinct({
            id: workspaces.id,
            createdAt: workspaces.createdAt,
            workspaceOwner: workspaces.workspaceOwner,
            title: workspaces.title,
            iconId: workspaces.iconId,
            data: workspaces.data,
            inTrash: workspaces.inTrash,
            logo: workspaces.logo,
            bannerUrl: workspaces.bannerUrl,
        })
        .from(workspaces)
        .orderBy(workspaces.createdAt)
        .innerJoin(collaborators, eq(workspaces.id, collaborators.workspaceId))
        .where(eq(workspaces.workspaceOwner, userId)) as workspace[];
    return sharedWorkspaces;
}

export async function getPage (folderId : string) {
    const data = await db.select().from(files).where(eq(files.folderId,folderId));
    return data[0].id;
}

export async function searchEmails (searchTerm : string) {
    if (!searchTerm) return [];
    const data = await db.query.users.findMany({where : (s,{ilike}) => ilike(s.email,`%${searchTerm}%`)})
    const supabase = await createClient();
    const usersWithImages = data.map((user) => {
        if (!user.avatarUrl) return {id : user.id, email : user.email, image : null};
        const {data} = supabase.storage.from("logos").getPublicUrl(`${user.avatarUrl}`);
        return {id : user.id, email : user.email, image: data.publicUrl}
    });
    return usersWithImages;
}

export async function getEditorContent (fileId : string) {
    try {
        const data = await db.select({contents : files.data}).from(files).where(eq(files.id, fileId));
        return JSON.parse(data[0].contents!);
    } catch (e) {
        console.log(e);
    }
}

export async function updateEditorContent(workspaceId : string, folder : string, fileId : string, contents : string) {
    try {
        await db.update(files).set({data:  contents}).where(eq(files.id,fileId))
    } catch (e) {
        console.log(e);
    }
}