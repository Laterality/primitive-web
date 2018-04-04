import * as express from "express";

import { IDatabase } from "../../../db/db-interface";
import * as resHandler from "../../../lib/response-handler";
import { checkRole } from "../../../lib/session-handler";

import { FileDBO } from "../../../db/file.dbo";
import { PostDBO } from "../../../db/post.dbo";
import { serialize } from "../../../lib/serializer";

export class PostAPI {
	private router: express.Router;

	public constructor(private db: IDatabase) {
		this.router = express.Router();
		this.router.post("/write", this.createPost);
		this.router.get("/page/:pageNum", this.retrievePostList);
		this.router.get("/:postId", this.retrievePostById);
		this.router.put("/update/:postId", this.updatePost);
		this.router.delete("/delete/:postId", this.deletePost);

	}

	public getRouter() {
		return this.router;
	}

	/**
	 * 게시물 작성
	 * 
	 * path: /post/write
	 * method: POST
	 * 
	 * Request
	 * @body post_title { string } 게시물 제목
	 * @body post_content { string } 게시물 내용
	 * @body board_title { string } 게시판명
	 * @body files_attached { string[] } 첨부파일id 배열
	 * 
	 * Response
	 * @body result { string } 결과
	 * @body message { string } 결과 메시지
	 * @body post { PostModel ] 작성된 게시물
	 */
	private async createPost(req: express.Request, res: express.Response) {
		const postTitle = req.body["post_title"];
		const postContent = req.body["post_content"];
		const board = req.body["board"];
		const filesAttached = req.body["files_attached"];

		if (!req.session) { throw new Error("session not exist"); }

		const boardFound = await this.db.findBoardByTitle(board);
		if (boardFound === null) {
			// 존재하지 않는 게시판명인경우
			return resHandler.response(res, 
				new resHandler.ApiResponse(
					resHandler.ApiResponse.CODE_INVALID_PARAMETERS,
					resHandler.ApiResponse.RESULT_FAIL,
					"not found(board)"));
		}
		const roleTitles: string[] = [];
		for (const r of boardFound.getRolesWritable()) {
			roleTitles.push(r.getTitle());
		}
		// 권한 검사
		const hasPermission = await checkRole(this.db, req, roleTitles);

		if (!hasPermission) {
			return resHandler.response(res,
				new resHandler.ApiResponse(
					resHandler.ApiResponse.CODE_FORBIDDEN,
					resHandler.ApiResponse.RESULT_FAIL));
		}

		const files: FileDBO[] = [];
		try {
			this.db.findFilesById(filesAttached);
		}
		catch (e) {
			if (e["message"] === "not found") {
				return resHandler.response(res,
					new resHandler.ApiResponse(
						resHandler.ApiResponse.CODE_INVALID_PARAMETERS,
						resHandler.ApiResponse.RESULT_FAIL,
						"not found(file)"));
			}
		}

		const author = await this.db.findUserById(req.session["userId"]);
		
		const postCreated = await this.db.createPost(new PostDBO(
			postTitle,
			postContent,
			boardFound,
			files,
			author,
			new Date(),
			[]));
		
		return resHandler.response(res, 
			new resHandler.ApiResponse(
				resHandler.ApiResponse.CODE_OK,
				resHandler.ApiResponse.RESULT_OK,
				"",
				{
					name: "post",
					obj: serialize(postCreated),
				},
			));
	}

	/**
	 * 생성날짜 내림차순 상위 5개 게시물 조회
	 * 
	 * path: /page/{pageNum}
	 * method: GET
	 * 
	 * Request
	 * @param pageNum { int } 조회할 페이지 번호
	 * @query year { int } 조회할 게시물 연도(기본값: 현재 연도)
	 * @query board { string } 게시판 id
	 * 
	 * Response
	 * @body result { string } 결과
	 * @body message { string } 결과 메시지
	 * @body posts { PostModel[] } 조회된 게시물 목록
	 */
	private async retrievePostList(req: express.Request, res: express.Response) {
		const pageNum	= req.params["pageNum"];
		const year		= req.query["year"];
		const boardId	= req.query["board"];

		if (!req.session) { throw new Error("session not exist"); }

		// 권한 검사
		if (!req.session["userId"]) {
			return resHandler.response(res,
				new resHandler.ApiResponse(
					resHandler.ApiResponse.CODE_FORBIDDEN,
					resHandler.ApiResponse.RESULT_FAIL,
					"login needed",
				));
		}

		const postsFound = await this.db.findPostsByBoard(boardId, year, pageNum, 5);

		for (const post of postsFound) {
			post.setExcerpt(100);
		}

		resHandler.response(res,
			new resHandler.ApiResponse(
				resHandler.ApiResponse.CODE_OK,
				resHandler.ApiResponse.RESULT_OK,
				"",
				{
					name: "posts",
					obj: serialize<PostDBO[]>(postsFound),
				},
			));
	}

	/**
	 * 게시물 상세 내용 조회
	 * 
	 * path: /{postId}
	 * method: GET
	 * 
	 * Request
	 * @param postId { string } 게시물 id
	 * 
	 * Response
	 * @param result { string } 결과
	 * @param message { string } 결과 메시지
	 * @param post { PostModel } 조회된 게시물
	 */
	private async retrievePostById(req: express.Request, res: express.Response) {
		const postId = req.params["postId"];

		if (!req.session) { throw new Error("session not exist"); }

		if (!req.session["userId"]) {
			return resHandler.response(res,
				new resHandler.ApiResponse(
					resHandler.ApiResponse.CODE_FORBIDDEN,
					resHandler.ApiResponse.RESULT_FAIL,
					"login needed",
				));
		}

		try {
			const postFound = await this.db.findPostById(postId);

			return resHandler.response(res, 
				new resHandler.ApiResponse(
					resHandler.ApiResponse.CODE_OK,
					resHandler.ApiResponse.RESULT_OK,
					"",
					{
						name: "post",
						obj: serialize(postFound),
					},
				));
		}
		catch (e) {
			if (e["message"] === "not found") {
				return resHandler.response(res,
					new resHandler.ApiResponse(
						resHandler.ApiResponse.CODE_NOT_FOUND,
						resHandler.ApiResponse.RESULT_FAIL,
						"not found",
					));
			}
			else { throw e; }
		}
	}

	/**
	 * 게시물 수정
	 * 
	 * path: /update/{postId}
	 * method: PUT
	 * 
	 * Request
	 * @param postId { string } 게시물 id
	 * @body post_title { string } 수정할 제목, null인 경우 현재 값 유지
	 * @body post_content { string } 수정할 내용, null인 경우 현재 값 유지
	 * @body files_attached { string[] } 수정할 파일 id 배열, null인 경우 현재 상태 유지
	 * 
	 * Response
	 * @body result { string } 결과
	 * @body message { sring } 결과 메시지
	 */
	private async updatePost(req: express.Request, res: express.Response) {
		const postId		= req.params["postId"];
		const postTitle		= req.body["post_title"];
		const postContent	= req.body["post_content"];
		const filesAttached	= req.body["files_attached"];

		if (!req.session) { throw new Error("session not exist"); }
		if (!req.session["userId"]) {
			return resHandler.response(res,
				new resHandler.ApiResponse(
					resHandler.ApiResponse.CODE_FORBIDDEN,
					resHandler.ApiResponse.RESULT_FAIL,
					"login needed",
				));
		}

		try {
			const postFound = await this.db.findPostById(postId);

			if (req.session["userId"] !== postFound.getAuthor().getId() &&
				!checkRole(this.db, req, "관리자")) {
					return resHandler.response(res, 
						new resHandler.ApiResponse(
							resHandler.ApiResponse.CODE_FORBIDDEN,
							resHandler.ApiResponse.RESULT_FAIL,
							"not permitted",
						));
				}

			if (filesAttached) {
				postFound.setFiles(await this.db.findFilesById(filesAttached));
			}
			if (postTitle) {
				postFound.setTitle(postTitle);
			}
			if (postContent) {
				postFound.setContent(postContent);
			}

			await this.db.updatePost(postFound);

			return resHandler.response(res,
				new resHandler.ApiResponse(
					resHandler.ApiResponse.CODE_OK,
					resHandler.ApiResponse.RESULT_OK,
				));

		}
		catch (e) {
			if (e["message"] === "not found") {
				return resHandler.response(res,
					new resHandler.ApiResponse(
						resHandler.ApiResponse.CODE_NOT_FOUND,
						resHandler.ApiResponse.RESULT_FAIL,
						"not found"));
			}
			else { throw e; }
		}
	}

	/**
	 * 게시물 삭제
	 * 
	 * path: /delete/{postId}
	 * method: DELETE
	 * 
	 * Request
	 * @param postId { string } 게시물 id
	 * 
	 * Response
	 * @body result { string } 결과
	 * @body message { string } 결과 메시지
	 */
	private async deletePost(req: express.Request, res: express.Response) {
		const postId = req.params["postId"];
		
		if (!req.session) { throw new Error("session not exist"); }
		if (!req.session["userId"]) {
			return resHandler.response(res,
				new resHandler.ApiResponse(
					resHandler.ApiResponse.CODE_FORBIDDEN,
					resHandler.ApiResponse.RESULT_FAIL,
					"login needed",
				));
		}

		try {
			const postFound = await this.db.findPostById(postId);

			if (req.session["userId"] !== postFound.getAuthor().getId() &&
				!checkRole(this.db, req, "관리자")) {
					return resHandler.response(res, 
						new resHandler.ApiResponse(
							resHandler.ApiResponse.CODE_FORBIDDEN,
							resHandler.ApiResponse.RESULT_FAIL,
							"not permitted",
						));
				}
		}
		catch (e) {
			if (e["message"] === "not found") {
				return resHandler.response(res, 
					new resHandler.ApiResponse(
						resHandler.ApiResponse.CODE_NOT_FOUND,
						resHandler.ApiResponse.RESULT_FAIL,
						"not found",
					));
			}
			throw e;
		}
	}
}