import { PostDBO } from "./post.dbo";
import { RoleDBO } from "./role.dbo";

export class BoardDBO {

	public constructor(
		private boardTitle: string,
		private rolesReadble: RoleDBO[],
		private rolesWritable: RoleDBO[],
		private id?: string | number,
		private posts: PostDBO[] = []) {

	}

	public getId() { return this.id; }
	public getTitle() { return this.boardTitle; }
	public getRolesReadable() { return this.rolesReadble; }
	public getRolesWritable() { return this.rolesWritable; }
	public getPosts() { return this.posts; }
	
	public setTitle(title: string) { this.boardTitle = title; }
	public setRolesReadable(roles: RoleDBO[]) { this.rolesReadble = roles; }
	public setRolesWritable(roles: RoleDBO[]) { this.rolesWritable = roles; }
}
